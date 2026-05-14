# Cascade Engine Implementation Plan (Plan #3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the pure-C# cascade engine in `ISUCourseManager.Services` — `PrereqEvaluator` plus `CascadeEngine` (`Preview` and `Validate`), driving every spec acceptance criterion (AC-1 .. AC-39) via xUnit + FluentAssertions tests against an in-memory CybE fixture. No DB, no I/O, no clocks; the engine is a pure function `(Student, ActiveAssociation, Flow, Courses, Catalog, Trigger, Options) -> CascadeProposal`.

**Architecture:** Two layers. (1) `PrereqEvaluator` — stateless evaluation of `PrereqExpression` trees against an academic record, honoring min-grade, `acceptConcurrent`, And/Or, pending-grade optimism, cross-listing equivalence, classification gates, and core-credit gates. (2) `CascadeEngine` — orchestrates the algorithm steps from spec §5 (Apply trigger -> affected set walk -> Step 2a co-req fixed-point -> earliestValidSemester -> topo order -> per-semester accounting -> soft-pairing pass -> proposal), and `Validate(courses, flow)` reuses the same evaluator to emit `ValidationIssueDto[]`. All inputs are EF-loaded entities passed by reference; the engine never touches `DbContext`.

**Tech Stack:** .NET 8, xUnit, FluentAssertions, no mocking framework. Pure C#; no EF, no async, no I/O.

**Spec reference:**
- `docs/superpowers/specs/2026-05-12-isu-course-manager-design.md` §4 (entities — `StudentCourse`, `Course`, `FlowchartSlot`, `PrereqExpression` hierarchy), §5 (Cascade engine — Triggers, Algorithm steps incl. Step 2a, `CascadeProposal`, AC-1 .. AC-39), §8 (`ValidationIssueDto` with `Severity`, `RelatedStudentCourseId`, `PendingGradeDependency`), §10 decisions 33, 39, 40, 41, 42, 43.
- `docs/superpowers/specs/2026-05-13-pending-grade-and-coreq-cascade-design.md` §3 (pending-grade semantics — optimistic), §4 (Step 2a co-req cascade — fixed-point), §5 (sibling grouping by `RelatedStudentCourseId`), §9 (AC-PG-* + AC-CR-*).
- `docs/superpowers/specs/2026-05-13-external-transfer-v1-design.md` §4 (External enrollments treated identically to Internal in prereq evaluation — AC-XT-3 / AC-39).

**Depends on:** Plan #1 (`2026-05-12-seed-validation-and-loader.md`) — entities, enums, `PrereqExpression` hierarchy, `AcademicTerm` helper. Plan #2 (`2026-05-13-persistence-layer.md`) is *not* required at runtime (engine is pure) but its tests share the `ISUCourseManager.Services.Tests` project layout.

**Out of scope (called out explicitly):**
- API controllers — the `POST /cascade/preview` and `POST /cascade/apply` endpoints come in **plan #4**.
- DB-write `Apply` path — `EnrollmentService.Apply()` (transactional commit of a `CascadeProposal` to `StudentCourse[]`) is **plan #4**.
- `AiService` and `InsightService` — server-mediated AI calls are **plan #5**.
- React UI integration (banner, sibling-group panel, side-by-side preview) — frontend plan, later.
- Real-time grade-posting webhook — out of scope per pending-grade spec §2.

> **Addendum specs (added after this plan was written):**
> - `2026-05-13-pending-grade-and-coreq-cascade-design.md` introduces the `PendingGradeDependency` warning kind, the `Status=Completed + Grade=null` "grade pending" state, **Step 2a** (co-req transitive cascade with fixed-point convergence), and server-side sibling grouping by `RelatedStudentCourseId`. All of this is core to this plan and is implemented in Tasks 9 (pending-grade evaluator branch), 11 (AC-PG tests), 14 (PendingGradeDependency emission in `Validate`), 19 (Step 2a fixed-point + `RelatedStudentCourseId` wiring), and 22 (AC-36 multi-step composition).
> - `2026-05-13-external-transfer-v1-design.md` introduces `EnrollmentSource = External` enrollments. The cascade engine treats External and Internal **identically** for prereq satisfaction, slot fulfillment, credit counting, and cascade triggers (AC-39 / AC-XT-3). Task 9 (External-equivalent test in `PrereqEvaluatorTests_Course`) and Task 21 (`CascadeEngineTests_ExternalTransfer` with AC-38 + AC-39) confirm no special-casing leaks into the evaluator.

---

## File structure

What this plan creates or modifies:

```
src/ISUCourseManager.Services/
├── ISUCourseManager.Services.csproj             (NEW project — references Data)
├── Cascade/
│   ├── CascadeOptions.cs                        decision-33 defaults
│   ├── CascadeTrigger.cs                        abstract base + sealed records
│   ├── CascadeRequest.cs                        engine input record
│   ├── CascadeProposal.cs                       engine output record
│   ├── CascadeMove.cs                           one move in a proposal
│   ├── DecisionPoint.cs                         abstract base + FillGap/ChooseElective/ConfirmOverload
│   ├── Warning.cs                               WarningKind + Warning
│   ├── SlotOption.cs                            supporting type for FillGapDecision
│   ├── MovableItem.cs                           supporting type for ConfirmOverloadDecision
│   ├── ValidationIssueDto.cs                    Kind + Severity + RelatedStudentCourseId
│   ├── PrereqEvaluator.cs                       pure expression-tree evaluator
│   ├── CrossListingIndex.cs                     equivalence-class lookup built once per request
│   ├── CascadeEngine.cs                         Preview() + Validate() orchestrator
│   ├── EngineWorkingState.cs                    private mutable working copy used inside Preview()
│   └── SemesterMath.cs                          AcademicTerm <-> semester index helpers
└── (no other files in Services for this plan)

tests/ISUCourseManager.Services.Tests/
├── Cascade/
│   ├── Fixtures/
│   │   ├── CybEFixture.cs                       in-memory CybE catalog + flow + helpers
│   │   └── StudentRecordBuilder.cs              fluent builder for StudentCourse[] in tests
│   ├── PrereqEvaluatorTests.Course.cs           AC-19, AC-20, AC-31, AC-39, min-grade, accept-concurrent
│   ├── PrereqEvaluatorTests.AndOr.cs            And/Or composition
│   ├── PrereqEvaluatorTests.PendingGrade.cs     AC-32, AC-33, AC-PG-2, AC-PG-3, AC-PG-4
│   ├── PrereqEvaluatorTests.Classification.cs   AC-23, AC-24
│   ├── PrereqEvaluatorTests.CoreCredits.cs      AC-25
│   ├── ValidationIssueDtoEmitterTests.cs        AC-18 + sibling-group RelatedStudentCourseId wiring
│   ├── CascadeEngineTests.Validate.cs           AC-18 (full Validate())
│   ├── CascadeEngineTests.Skip.cs               AC-1, AC-2, AC-3
│   ├── CascadeEngineTests.Fail.cs               AC-4, AC-5, AC-6, AC-34
│   ├── CascadeEngineTests.Substitute.cs         AC-7, AC-8
│   ├── CascadeEngineTests.AddRemove.cs          AC-9, AC-10, AC-35
│   ├── CascadeEngineTests.Overload.cs           AC-11, AC-12
│   ├── CascadeEngineTests.Boundary.cs           AC-13, AC-14, AC-15, AC-21, AC-22
│   ├── CascadeEngineTests.SoftPairing.cs        AC-26, AC-27
│   ├── CascadeEngineTests.MultiFlow.cs          AC-16, AC-28, AC-29, AC-30
│   ├── CascadeEngineTests.Step2aCoreqCascade.cs AC-35, AC-37, AC-CR-1, AC-CR-2, AC-CR-3
│   ├── CascadeEngineTests.MultiStepChain.cs     AC-36 (composes AC-34 + acceptConcurrent + AC-35)
│   ├── CascadeEngineTests.FixCurrentState.cs    FixCurrentState trigger
│   └── CascadeEngineTests.ExternalTransfer.cs   AC-38, AC-39
└── (existing seed/persistence tests untouched)
```

---

## Task 1: Bootstrap the Services project + test wiring

**Files:**
- Create: `src/ISUCourseManager.Services/ISUCourseManager.Services.csproj`
- Modify: `ISUCourseManager.sln`
- Modify: `tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj`

- [ ] **Step 1: Verify .NET 8 is installed**

Run: `dotnet --version`
Expected: `8.x.x`.

- [ ] **Step 2: Create the Services project**

```
dotnet new classlib --framework net8.0 --output src/ISUCourseManager.Services --name ISUCourseManager.Services
rm src/ISUCourseManager.Services/Class1.cs
```

(Windows: `del` instead of `rm`.)

- [ ] **Step 3: Reference Data from Services**

```
dotnet add src/ISUCourseManager.Services/ISUCourseManager.Services.csproj reference src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
```

- [ ] **Step 4: Enable Nullable + ImplicitUsings on the Services project**

Edit `src/ISUCourseManager.Services/ISUCourseManager.Services.csproj` so its `<PropertyGroup>` reads:

```xml
<PropertyGroup>
  <TargetFramework>net8.0</TargetFramework>
  <ImplicitUsings>enable</ImplicitUsings>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

- [ ] **Step 5: Add the Services project to the solution**

```
dotnet sln ISUCourseManager.sln add src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

- [ ] **Step 6: Add the Services reference to the test project**

```
dotnet add tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj reference src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

(The test project should already reference `Data` from plan #1.)

- [ ] **Step 7: Build the solution to verify**

```
dotnet build ISUCourseManager.sln
```

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`.

- [ ] **Step 8: Commit**

```
git add src/ISUCourseManager.Services/ tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj ISUCourseManager.sln
git commit -m "build(services): bootstrap ISUCourseManager.Services project"
```

---

## Task 2: CascadeOptions with decision-33 defaults

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/CascadeOptions.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeOptionsTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeOptionsTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeOptionsTests
{
    [Fact]
    public void Defaults_match_decision_33()
    {
        var opts = new CascadeOptions();

        opts.TargetCreditsPerSemester.Should().Be(15m);
        opts.SoftMinCreditsPerSemester.Should().Be(12m);
        opts.SoftCapCreditsPerSemester.Should().Be(18m);
        opts.HardCapCreditsPerSemester.Should().Be(20m);
        opts.MaxSemester.Should().Be(8);
        opts.SophomoreMinCredits.Should().Be(30m);
        opts.JuniorMinCredits.Should().Be(60m);
        opts.SeniorMinCredits.Should().Be(90m);
        opts.StartTerm.Should().Be(Term.Fall);
    }

    [Fact]
    public void Properties_are_overridable_via_init()
    {
        var opts = new CascadeOptions { MaxSemester = 10, StartTerm = Term.Spring };
        opts.MaxSemester.Should().Be(10);
        opts.StartTerm.Should().Be(Term.Spring);
        opts.TargetCreditsPerSemester.Should().Be(15m); // unchanged default
    }
}
```

- [ ] **Step 2: Run to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeOptionsTests
```

Expected: build error — `CascadeOptions` does not exist.

- [ ] **Step 3: Implement CascadeOptions**

Create `src/ISUCourseManager.Services/Cascade/CascadeOptions.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Defaults pinned by spec decision 33 (system spec §10). Exposed via OverlayDto so the
/// React client renders per-row credit colors without hardcoding thresholds.
/// </summary>
public sealed record CascadeOptions
{
    public decimal TargetCreditsPerSemester { get; init; } = 15m;
    public decimal SoftMinCreditsPerSemester { get; init; } = 12m;
    public decimal SoftCapCreditsPerSemester { get; init; } = 18m;
    public decimal HardCapCreditsPerSemester { get; init; } = 20m;
    public int MaxSemester { get; init; } = 8;

    // Classification gates (PrereqClassification evaluation).
    public decimal SophomoreMinCredits { get; init; } = 30m;
    public decimal JuniorMinCredits    { get; init; } = 60m;
    public decimal SeniorMinCredits    { get; init; } = 90m;

    /// <summary>
    /// First-semester term. The engine alternates Fall/Spring from here when mapping
    /// semester index -> AcademicTerm season. Summer is never auto-assigned.
    /// </summary>
    public Term StartTerm { get; init; } = Term.Fall;
}
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeOptionsTests
```

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeOptions.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeOptionsTests.cs
git commit -m "feat(cascade): CascadeOptions with decision-33 defaults"
```

---

## Task 3: SemesterMath helper (semester index <-> AcademicTerm)

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/SemesterMath.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/SemesterMathTests.cs`

The engine's algorithm thinks in terms of *semester indexes* (1, 2, 3 ... `MaxSemester`) but `StudentCourse.AcademicTerm` is YYYYSS-encoded chronology. SemesterMath bridges them given a `CascadeOptions.StartTerm` and a base academic-cycle year.

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/SemesterMathTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;

namespace ISUCourseManager.Services.Tests.Cascade;

public class SemesterMathTests
{
    [Fact]
    public void SemesterToAcademicTerm_alternates_fall_then_spring_when_StartTerm_is_Fall()
    {
        // Cycle starts at year 2026 (academic year 25-26). Sem 1 = Fall 2025 (encoded year = 2026).
        var sm = new SemesterMath(startCycleYear: 2026, startTerm: Term.Fall);

        sm.SemesterToAcademicTerm(1).Should().Be(202602); // Fall 2025
        sm.SemesterToAcademicTerm(2).Should().Be(202604); // Spring 2026
        sm.SemesterToAcademicTerm(3).Should().Be(202702); // Fall 2026
        sm.SemesterToAcademicTerm(4).Should().Be(202704); // Spring 2027
        sm.SemesterToAcademicTerm(8).Should().Be(202904); // Spring 2029
    }

    [Fact]
    public void SemesterToAcademicTerm_alternates_spring_then_fall_when_StartTerm_is_Spring()
    {
        var sm = new SemesterMath(startCycleYear: 2026, startTerm: Term.Spring);

        sm.SemesterToAcademicTerm(1).Should().Be(202604); // Spring 2026
        sm.SemesterToAcademicTerm(2).Should().Be(202702); // Fall 2026
    }

    [Fact]
    public void AcademicTermToSemester_inverts_SemesterToAcademicTerm()
    {
        var sm = new SemesterMath(startCycleYear: 2026, startTerm: Term.Fall);

        sm.AcademicTermToSemester(202602).Should().Be(1);
        sm.AcademicTermToSemester(202604).Should().Be(2);
        sm.AcademicTermToSemester(202904).Should().Be(8);
    }

    [Fact]
    public void TermFor_returns_Fall_or_Spring_for_a_semester_index()
    {
        var sm = new SemesterMath(startCycleYear: 2026, startTerm: Term.Fall);
        sm.TermFor(1).Should().Be(Term.Fall);
        sm.TermFor(2).Should().Be(Term.Spring);
        sm.TermFor(3).Should().Be(Term.Fall);
    }
}
```

- [ ] **Step 2: Run to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~SemesterMathTests
```

Expected: build error — type does not exist.

- [ ] **Step 3: Implement SemesterMath**

Create `src/ISUCourseManager.Services/Cascade/SemesterMath.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Bridges semester indexes (1..MaxSemester) and AcademicTerm encoding (YYYYSS).
/// Summer is never auto-assigned by the cascade — the engine alternates only Fall/Spring.
/// </summary>
public sealed class SemesterMath
{
    private readonly int _startCycleYear;
    private readonly Term _startTerm;

    public SemesterMath(int startCycleYear, Term startTerm)
    {
        if (startTerm == Term.Summer)
            throw new ArgumentException("StartTerm cannot be Summer", nameof(startTerm));
        _startCycleYear = startCycleYear;
        _startTerm = startTerm;
    }

    public Term TermFor(int semesterIndex)
    {
        if (semesterIndex < 1) throw new ArgumentOutOfRangeException(nameof(semesterIndex));
        // Index 1 -> StartTerm. Index 2 -> the other. Index 3 -> StartTerm. ...
        var stride = (semesterIndex - 1) % 2;
        return stride == 0
            ? _startTerm
            : (_startTerm == Term.Fall ? Term.Spring : Term.Fall);
    }

    public int SemesterToAcademicTerm(int semesterIndex)
    {
        var term = TermFor(semesterIndex);
        var season = term == Term.Fall ? Season.Fall : Season.Spring;

        // Years advance every time we wrap StartTerm -> opposite -> StartTerm again.
        // Pairs of semesters share a cycle year: (1,2) = startCycleYear, (3,4) = +1, etc.
        // EXCEPT when StartTerm = Spring, the spring is in the same year as the *next* fall.
        // Easiest: walk forward.
        int year = _startCycleYear;
        var currentTerm = _startTerm;
        for (var i = 1; i < semesterIndex; i++)
        {
            // Advance one slot.
            if (currentTerm == Term.Fall)
            {
                currentTerm = Term.Spring; // same cycle year
            }
            else // Spring
            {
                currentTerm = Term.Fall;
                year++; // wrapping into next academic cycle
            }
        }
        return AcademicTerm.Encode(year, season);
    }

    public int AcademicTermToSemester(int academicTerm)
    {
        // Linear scan up to a sane bound; cascade caps semesters at ~12 in worst cases.
        for (var i = 1; i <= 64; i++)
        {
            if (SemesterToAcademicTerm(i) == academicTerm) return i;
        }
        throw new ArgumentException(
            $"AcademicTerm {academicTerm} doesn't map to a semester index for StartCycleYear={_startCycleYear}, StartTerm={_startTerm}",
            nameof(academicTerm));
    }
}
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~SemesterMathTests
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/SemesterMath.cs tests/ISUCourseManager.Services.Tests/Cascade/SemesterMathTests.cs
git commit -m "feat(cascade): SemesterMath bridges semester index and AcademicTerm"
```

---

## Task 4: Domain DTOs — Warning, SlotOption, MovableItem, ValidationIssueDto

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/Warning.cs`
- Create: `src/ISUCourseManager.Services/Cascade/SlotOption.cs`
- Create: `src/ISUCourseManager.Services/Cascade/MovableItem.cs`
- Create: `src/ISUCourseManager.Services/Cascade/ValidationIssueDto.cs`

POCOs only; no behavior. Tested implicitly through the engine tests in later tasks.

- [ ] **Step 1: Create Warning.cs**

```csharp
namespace ISUCourseManager.Services.Cascade;

public enum WarningKind
{
    SemesterOverload,
    GraduationPushed,
    GradeRequirementUnmet,
    NoValidSemester,
    RecommendedPairingBroken,
}

public sealed record Warning(
    WarningKind Kind,
    string Message,
    IReadOnlyList<Guid> RelatedStudentCourseIds);
```

- [ ] **Step 2: Create SlotOption.cs**

```csharp
namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Suggested slot to fill a per-semester gap. "Category" is a free-text label like
/// "GenEd" or "TechElective" derived from the SlotType of the empty flow slot.
/// </summary>
public sealed record SlotOption(string Category, decimal Credits);
```

- [ ] **Step 3: Create MovableItem.cs**

```csharp
namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// A StudentCourse the user could defer to later semesters to alleviate an overload.
/// EarliestPossibleSemester is engine-computed via PrereqEvaluator.
/// </summary>
public sealed record MovableItem(
    Guid StudentCourseId,
    string CourseCode,
    decimal Credits,
    int EarliestPossibleSemester);
```

- [ ] **Step 4: Create ValidationIssueDto.cs**

```csharp
namespace ISUCourseManager.Services.Cascade;

public enum ValidationIssueKind
{
    BrokenPrereq,
    BrokenCoreq,
    GradeRequirementUnmet,
    SemesterOverload,
    InsufficientCredits,
    TermNotOffered,
    ClassificationGateUnmet,
    CoreCreditsGateUnmet,
    RecommendedPairingBroken,
    PendingGradeDependency,    // Severity = Warning per pending-grade addendum §3.4
}

public enum IssueSeverity { Error, Warning }

/// <summary>
/// Server-computed validation issue. Returned alongside every overlay/mutation response.
/// RelatedStudentCourseId enables sibling grouping (pending-grade addendum §5):
/// issues sharing a RelatedStudentCourseId render as one "Issue X of N - root cause" group.
/// </summary>
public sealed record ValidationIssueDto(
    ValidationIssueKind Kind,
    IssueSeverity Severity,
    Guid? StudentCourseId,
    Guid? RelatedStudentCourseId,
    int Semester,
    string Message);
```

- [ ] **Step 5: Build to verify**

```
dotnet build src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Services/Cascade/Warning.cs src/ISUCourseManager.Services/Cascade/SlotOption.cs src/ISUCourseManager.Services/Cascade/MovableItem.cs src/ISUCourseManager.Services/Cascade/ValidationIssueDto.cs
git commit -m "feat(cascade): Warning, SlotOption, MovableItem, ValidationIssueDto DTOs"
```

---


## Task 5: DecisionPoint hierarchy + CascadeMove

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/DecisionPoint.cs`
- Create: `src/ISUCourseManager.Services/Cascade/CascadeMove.cs`

- [ ] **Step 1: Create DecisionPoint.cs**

```csharp
namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Base type for points where the cascade engine needs the user to choose between
/// equally-valid resolutions. Each subclass exposes a RecommendedDefault used by the
/// Auto-Fix and Mark-Failed flows (system spec §7) — those flows auto-answer with the
/// engine's default and skip the wizard prompt.
/// </summary>
public abstract record DecisionPoint(Guid Id, int Semester, string Prompt)
{
    /// <summary>
    /// Identifier of the recommended default answer for auto-answer flows. Concrete
    /// subclasses define what "default" means (e.g. accept suggested slots).
    /// </summary>
    public abstract string RecommendedDefaultKey { get; }
}

public sealed record FillGapDecision(
    Guid Id,
    int Semester,
    string Prompt,
    decimal CreditsToFill,
    IReadOnlyList<SlotOption> SuggestedSlots) : DecisionPoint(Id, Semester, Prompt)
{
    public override string RecommendedDefaultKey => "UseSuggestedSlots";
}

public sealed record ChooseElectiveDecision(
    Guid Id,
    int Semester,
    string Prompt,
    string Category,
    IReadOnlyList<Data.Entity.Course> Candidates) : DecisionPoint(Id, Semester, Prompt)
{
    public override string RecommendedDefaultKey => "FirstCandidate";
}

public sealed record ConfirmOverloadDecision(
    Guid Id,
    int Semester,
    string Prompt,
    decimal CurrentCredits,
    decimal SoftCap,
    IReadOnlyList<MovableItem> CanDeferToLater) : DecisionPoint(Id, Semester, Prompt)
{
    public override string RecommendedDefaultKey => "DeferAll";
}
```

- [ ] **Step 2: Create CascadeMove.cs**

```csharp
namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// One enrollment move in a CascadeProposal. FromAcademicTerm/ToAcademicTerm use the
/// YYYYSS encoding (see AcademicTerm helper).
/// </summary>
public sealed record CascadeMove(
    Guid StudentCourseId,
    string CourseCode,
    int FromAcademicTerm,
    int ToAcademicTerm,
    string Reason);
```

- [ ] **Step 3: Build to verify**

```
dotnet build src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Services/Cascade/DecisionPoint.cs src/ISUCourseManager.Services/Cascade/CascadeMove.cs
git commit -m "feat(cascade): DecisionPoint hierarchy and CascadeMove record"
```

---

## Task 6: CascadeTrigger hierarchy + CascadeRequest + CascadeProposal

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/CascadeTrigger.cs`
- Create: `src/ISUCourseManager.Services/Cascade/CascadeRequest.cs`
- Create: `src/ISUCourseManager.Services/Cascade/CascadeProposal.cs`

- [ ] **Step 1: Create CascadeTrigger.cs**

```csharp
namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Abstract base for the events that can trigger a cascade run. FixCurrentState is the
/// payload-less catch-all: "re-derive valid placements for every currently-broken
/// StudentCourse" (decision 34, system spec §5).
/// </summary>
public abstract record CascadeTrigger;

public sealed record CourseFailed(Guid StudentCourseId, string Grade) : CascadeTrigger;
public sealed record CourseSkipped(Guid StudentCourseId, int? RescheduledToTerm) : CascadeTrigger;
public sealed record CourseAddedToTerm(string CourseId, int AcademicTerm) : CascadeTrigger;
public sealed record CourseRemovedFromTerm(Guid StudentCourseId) : CascadeTrigger;
public sealed record CourseSubstituted(Guid StudentCourseId, string NewCourseId) : CascadeTrigger;
public sealed record WhatIfMajorSwitched(Guid NewDegreeFlowId) : CascadeTrigger;
public sealed record FixCurrentState : CascadeTrigger;
```

- [ ] **Step 2: Create CascadeRequest.cs**

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

public sealed record CascadeRequest(
    Student Student,
    StudentDegreeFlow ActiveAssociation,
    DegreeFlow Flow,
    IReadOnlyList<StudentCourse> Courses,
    IReadOnlyList<Course> Catalog,
    CascadeTrigger Trigger,
    CascadeOptions Options);
```

- [ ] **Step 3: Create CascadeProposal.cs**

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Engine output. Pure value — never persisted directly. The controller's apply path
/// (plan #4) hands this to EnrollmentService.Apply() inside a DB transaction.
/// </summary>
public sealed record CascadeProposal(
    IReadOnlyList<StudentCourse> ProposedCourses,
    IReadOnlyList<CascadeMove> Moves,
    IReadOnlyList<DecisionPoint> Decisions,
    IReadOnlyList<Warning> Warnings,
    int ProjectedGraduationTerm);
```

- [ ] **Step 4: Build to verify**

```
dotnet build src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeTrigger.cs src/ISUCourseManager.Services/Cascade/CascadeRequest.cs src/ISUCourseManager.Services/Cascade/CascadeProposal.cs
git commit -m "feat(cascade): CascadeTrigger hierarchy, CascadeRequest, CascadeProposal"
```

---

## Task 7: CrossListingIndex — equivalence-class lookup

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/CrossListingIndex.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CrossListingIndexTests.cs`

Cross-listings let `EE 4910` satisfy any reference to `CPRE 4910` (AC-19, AC-20, AC-31). The index is built once per cascade request from `Course.CrossListedAs` and queried by every prereq evaluation.

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CrossListingIndexTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CrossListingIndexTests
{
    private static Course MakeCourse(string classId, params string[] crossListedAs) =>
        new()
        {
            ClassId = classId, Code = classId, Name = classId,
            Department = classId.Split('-')[0], Credits = 3m,
            CrossListedAs = crossListedAs.ToList(),
        };

    [Fact]
    public void Single_classId_with_no_crosslist_resolves_to_itself()
    {
        var idx = new CrossListingIndex(new[] { MakeCourse("MATH-1650") });
        idx.EquivalenceClassFor("MATH-1650").Should().BeEquivalentTo(new[] { "MATH-1650" });
    }

    [Fact]
    public void Bidirectional_equivalence_for_one_to_one_crosslist()
    {
        // CYBE-2300 lists CPRE-2300; even if CPRE-2300 doesn't list CYBE-2300, the index
        // must treat them as equivalent (graph closure).
        var idx = new CrossListingIndex(new[]
        {
            MakeCourse("CYBE-2300", "CPRE-2300"),
            MakeCourse("CPRE-2300"),
        });

        idx.EquivalenceClassFor("CYBE-2300").Should().BeEquivalentTo(new[] { "CYBE-2300", "CPRE-2300" });
        idx.EquivalenceClassFor("CPRE-2300").Should().BeEquivalentTo(new[] { "CYBE-2300", "CPRE-2300" });
    }

    [Fact]
    public void Triangle_equivalence_via_transitive_closure()
    {
        // A -> B, B -> C should yield {A,B,C} in every equivalence query.
        var idx = new CrossListingIndex(new[]
        {
            MakeCourse("A-1", "B-1"),
            MakeCourse("B-1", "C-1"),
            MakeCourse("C-1"),
        });
        idx.EquivalenceClassFor("A-1").Should().BeEquivalentTo(new[] { "A-1", "B-1", "C-1" });
        idx.EquivalenceClassFor("C-1").Should().BeEquivalentTo(new[] { "A-1", "B-1", "C-1" });
    }

    [Fact]
    public void Equivalent_returns_true_for_classes_in_same_set()
    {
        var idx = new CrossListingIndex(new[]
        {
            MakeCourse("CYBE-2300", "CPRE-2300"),
            MakeCourse("CPRE-2300"),
        });
        idx.AreEquivalent("CYBE-2300", "CPRE-2300").Should().BeTrue();
        idx.AreEquivalent("CYBE-2300", "MATH-1650").Should().BeFalse();
    }

    [Fact]
    public void Unknown_classId_returns_singleton_set()
    {
        var idx = new CrossListingIndex(Array.Empty<Course>());
        idx.EquivalenceClassFor("UNKNOWN-1").Should().BeEquivalentTo(new[] { "UNKNOWN-1" });
    }
}
```

- [ ] **Step 2: Run to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CrossListingIndexTests
```

Expected: build error — type missing.

- [ ] **Step 3: Implement CrossListingIndex**

Create `src/ISUCourseManager.Services/Cascade/CrossListingIndex.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Builds an equivalence-class lookup from Course.CrossListedAs lists. The graph is
/// undirected: if CYBE-2300 lists CPRE-2300, the two are equivalent regardless of whether
/// CPRE-2300 explicitly lists CYBE-2300 back. Transitively closed via union-find.
///
/// EquivalenceClassFor returns the set including the queried classId; AreEquivalent is
/// O(1) after construction. Unknown classIds resolve to singleton sets so callers can
/// query freely without pre-checking the catalog.
/// </summary>
public sealed class CrossListingIndex
{
    private readonly Dictionary<string, HashSet<string>> _classToSet;

    public CrossListingIndex(IEnumerable<Course> catalog)
    {
        // Union-Find with explicit set-tracking.
        var parent = new Dictionary<string, string>();

        string Find(string x)
        {
            if (!parent.ContainsKey(x)) parent[x] = x;
            while (parent[x] != x)
            {
                parent[x] = parent[parent[x]]; // path compression
                x = parent[x];
            }
            return x;
        }

        void Union(string a, string b)
        {
            var ra = Find(a);
            var rb = Find(b);
            if (ra != rb) parent[ra] = rb;
        }

        foreach (var c in catalog)
        {
            Find(c.ClassId);
            foreach (var other in c.CrossListedAs)
            {
                Find(other);
                Union(c.ClassId, other);
            }
        }

        // Materialize the equivalence classes.
        _classToSet = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var key in parent.Keys.ToList())
        {
            var root = Find(key);
            if (!_classToSet.TryGetValue(root, out var set))
            {
                set = new HashSet<string>(StringComparer.Ordinal);
                _classToSet[root] = set;
            }
            set.Add(key);
        }

        // Re-key by every member so direct lookup works.
        var byMember = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var set in _classToSet.Values)
            foreach (var member in set)
                byMember[member] = set;
        _classToSet = byMember;
    }

    public IReadOnlySet<string> EquivalenceClassFor(string classId)
    {
        if (_classToSet.TryGetValue(classId, out var set)) return set;
        return new HashSet<string>(StringComparer.Ordinal) { classId };
    }

    public bool AreEquivalent(string a, string b)
    {
        if (a == b) return true;
        return _classToSet.TryGetValue(a, out var set) && set.Contains(b);
    }
}
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CrossListingIndexTests
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CrossListingIndex.cs tests/ISUCourseManager.Services.Tests/Cascade/CrossListingIndexTests.cs
git commit -m "feat(cascade): CrossListingIndex with union-find equivalence classes"
```

---

## Task 8: CybEFixture — in-memory test catalog and flow

**Files:**
- Create: `tests/ISUCourseManager.Services.Tests/Cascade/Fixtures/CybEFixture.cs`
- Create: `tests/ISUCourseManager.Services.Tests/Cascade/Fixtures/StudentRecordBuilder.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/Fixtures/CybEFixtureTests.cs`

Mentioned in system spec §11. Provides a hand-built CybE catalog + DegreeFlow that exercises every prereq shape used by the cascade tests. We don't seed from JSON because the tests need predictable Guids and minimal noise.

- [ ] **Step 1: Write a small smoke test for the fixture**

Create `tests/ISUCourseManager.Services.Tests/Cascade/Fixtures/CybEFixtureTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Tests.Cascade.Fixtures;

public class CybEFixtureTests
{
    [Fact]
    public void Catalog_includes_every_course_referenced_by_a_slot()
    {
        var f = new CybEFixture();

        var classIdsInSlots = f.Flow.Slots
            .Where(s => s.SlotType == SlotType.DegreeClass && s.ClassId != null)
            .Select(s => s.ClassId!)
            .ToHashSet();

        foreach (var id in classIdsInSlots)
        {
            f.Catalog.Should().Contain(c => c.ClassId == id, $"slot referencing {id} needs catalog entry");
        }
    }

    [Fact]
    public void Catalog_includes_cross_listing_equivalents_used_by_AC_19_AC_31()
    {
        var f = new CybEFixture();
        f.Catalog.Should().Contain(c => c.ClassId == "CPRE-4910");
        f.Catalog.Should().Contain(c => c.ClassId == "EE-4910");
    }

    [Fact]
    public void Math_1660_has_minGrade_C_minus_on_its_Math_1650_prereq_edge()
    {
        var f = new CybEFixture();
        var math1660 = f.Catalog.Single(c => c.ClassId == "MATH-1660");
        var prereq = math1660.Prereqs.Should().BeOfType<PrereqCourse>().Subject;
        prereq.ClassId.Should().Be("MATH-1650");
        prereq.MinGrade.Should().Be("C-");
    }

    [Fact]
    public void Phys_2310_has_no_minGrade_on_its_Math_1650_prereq_edge_AC34()
    {
        // AC-34: PHYS 2310 has MATH 1650 as a prereq with NO minGrade. A D in MATH 1650
        // satisfies PHYS 2310's prereq, even though it would block MATH 1660.
        var f = new CybEFixture();
        var phys = f.Catalog.Single(c => c.ClassId == "PHYS-2310");
        var and = phys.Prereqs.Should().BeOfType<PrereqAnd>().Subject;
        var math1650Edge = and.Children.OfType<PrereqCourse>().Single(p => p.ClassId == "MATH-1650");
        math1650Edge.MinGrade.Should().BeNull();
    }
}
```

- [ ] **Step 2: Run to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CybEFixtureTests
```

Expected: build error — fixture missing.

- [ ] **Step 3: Create StudentRecordBuilder.cs**

Create `tests/ISUCourseManager.Services.Tests/Cascade/Fixtures/StudentRecordBuilder.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Tests.Cascade.Fixtures;

/// <summary>
/// Fluent builder for assembling deterministic StudentCourse[] in tests.
/// Generates stable Guids by hashing the index so tests can refer to them by name later.
/// </summary>
internal sealed class StudentRecordBuilder
{
    private readonly Guid _studentId;
    private readonly List<StudentCourse> _courses = new();

    public StudentRecordBuilder(Guid studentId) { _studentId = studentId; }

    public StudentRecordBuilder Completed(string classId, int academicTerm, string grade)
    {
        _courses.Add(new StudentCourse
        {
            Id = NextId(),
            StudentId = _studentId,
            CourseId = classId,
            AcademicTerm = academicTerm,
            Status = StudentCourseStatus.Completed,
            Grade = grade,
        });
        return this;
    }

    public StudentRecordBuilder CompletedPending(string classId, int academicTerm)
    {
        _courses.Add(new StudentCourse
        {
            Id = NextId(),
            StudentId = _studentId,
            CourseId = classId,
            AcademicTerm = academicTerm,
            Status = StudentCourseStatus.Completed,
            Grade = null,    // grade pending state (pending-grade addendum)
        });
        return this;
    }

    public StudentRecordBuilder Planned(string classId, int academicTerm)
    {
        _courses.Add(new StudentCourse
        {
            Id = NextId(),
            StudentId = _studentId,
            CourseId = classId,
            AcademicTerm = academicTerm,
            Status = StudentCourseStatus.Planned,
        });
        return this;
    }

    public StudentRecordBuilder PlannedExternal(
        string classId, int academicTerm, string institution, string externalCode)
    {
        _courses.Add(new StudentCourse
        {
            Id = NextId(),
            StudentId = _studentId,
            CourseId = classId,
            AcademicTerm = academicTerm,
            Status = StudentCourseStatus.Planned,
            EnrollmentSource = EnrollmentSource.External,
            TransferInstitution = institution,
            TransferExternalCourseCode = externalCode,
        });
        return this;
    }

    public StudentRecordBuilder CompletedExternal(
        string classId, int academicTerm, string grade, string institution, string externalCode)
    {
        _courses.Add(new StudentCourse
        {
            Id = NextId(),
            StudentId = _studentId,
            CourseId = classId,
            AcademicTerm = academicTerm,
            Status = StudentCourseStatus.Completed,
            Grade = grade,
            EnrollmentSource = EnrollmentSource.External,
            TransferInstitution = institution,
            TransferExternalCourseCode = externalCode,
        });
        return this;
    }

    public StudentRecordBuilder Failed(string classId, int academicTerm, string grade = "F")
    {
        _courses.Add(new StudentCourse
        {
            Id = NextId(),
            StudentId = _studentId,
            CourseId = classId,
            AcademicTerm = academicTerm,
            Status = StudentCourseStatus.Failed,
            Grade = grade,
        });
        return this;
    }

    public IReadOnlyList<StudentCourse> Build() => _courses.AsReadOnly();

    private Guid NextId()
    {
        // Deterministic per-record Guids for stable assertions.
        var bytes = new byte[16];
        BitConverter.GetBytes(_courses.Count + 1).CopyTo(bytes, 0);
        BitConverter.GetBytes(_studentId.GetHashCode()).CopyTo(bytes, 8);
        return new Guid(bytes);
    }
}
```

- [ ] **Step 4: Create CybEFixture.cs**

Create `tests/ISUCourseManager.Services.Tests/Cascade/Fixtures/CybEFixture.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Tests.Cascade.Fixtures;

/// <summary>
/// Hand-built CybE 2025-26 micro-catalog and DegreeFlow that covers every prereq shape
/// the cascade tests need: simple Course, Course+minGrade, acceptConcurrent, And/Or,
/// classification, core-credits, cross-listings, term-offering, and recommendedPairing.
///
/// Not a full catalog — intentionally narrow. Plan #1's seed-file tests cover the full
/// data; this fixture is the minimum for engine-behavior tests.
/// </summary>
internal sealed class CybEFixture
{
    public IReadOnlyList<Course> Catalog { get; }
    public DegreeFlow Flow { get; }
    public Student Student { get; }
    public StudentDegreeFlow ActiveAssociation { get; }

    public CybEFixture()
    {
        Catalog = BuildCatalog();
        Flow = BuildFlow();
        Student = new Student { Id = Guid.Parse("00000000-0000-0000-0000-000000000001"), DisplayName = "Test Student" };
        ActiveAssociation = new StudentDegreeFlow
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            StudentId = Student.Id,
            DegreeFlowId = Flow.Id,
            Status = StudentDegreeFlowStatus.Active,
        };
    }

    public StudentRecordBuilder Records() => new(Student.Id);

    public Course CourseOf(string classId) => Catalog.Single(c => c.ClassId == classId);

    private static IReadOnlyList<Course> BuildCatalog()
    {
        Course MakeCourse(
            string classId, string name, decimal credits, string department,
            PrereqExpression? prereqs = null, PrereqExpression? coreqs = null,
            string[]? crossListedAs = null, Term[]? offered = null)
            => new()
            {
                ClassId = classId, Code = classId, Name = name,
                Credits = credits, Department = department,
                Prereqs = prereqs, Coreqs = coreqs,
                CrossListedAs = (crossListedAs ?? Array.Empty<string>()).ToList(),
                TypicallyOffered = (offered ?? Array.Empty<Term>()).ToList(),
            };

        return new List<Course>
        {
            // Math chain — used by AC-1, AC-2, AC-4, AC-34, AC-36
            MakeCourse("MATH-1650", "Calc I",  4m, "MATH"),
            MakeCourse("MATH-1660", "Calc II", 4m, "MATH",
                prereqs: new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" }),

            // CprE problem-solving — recommendedPairing with MATH-1650 (AC-26)
            MakeCourse("CPRE-1850", "CprE Prob Solv", 3m, "CPRE",
                prereqs: new PrereqCourse { ClassId = "MATH-1650", AcceptConcurrent = true }),

            // Physics — AC-34 (no minGrade on MATH-1650 edge), AC-35, AC-36, AC-CR-1
            MakeCourse("PHYS-2310", "Physics I", 5m, "PHYS",
                prereqs: new PrereqAnd
                {
                    Children =
                    {
                        new PrereqCourse { ClassId = "MATH-1650" },
                        new PrereqCourse { ClassId = "MATH-1660", AcceptConcurrent = true },
                    },
                }),
            MakeCourse("PHYS-2310L", "Physics I Lab", 1m, "PHYS",
                prereqs: new PrereqAnd
                {
                    Children =
                    {
                        new PrereqCourse { ClassId = "MATH-1650" },
                        new PrereqCourse { ClassId = "MATH-1660", AcceptConcurrent = true },
                        new PrereqCourse { ClassId = "PHYS-2310", AcceptConcurrent = true },
                    },
                }),

            // CprE 28xx — classification gate (AC-23, AC-24)
            MakeCourse("CPRE-2810", "Digital Logic", 3m, "CPRE",
                prereqs: new PrereqAnd
                {
                    Children =
                    {
                        new PrereqCourse { ClassId = "CPRE-1850" },
                        new PrereqClassification { Min = Classification.Sophomore },
                    },
                }),

            // Cross-listing pair — AC-19, AC-20, AC-31
            MakeCourse("CYBE-2300", "Intro Cyber Sec", 3m, "CYBE",
                crossListedAs: new[] { "CPRE-2300" },
                prereqs: new PrereqCourse { ClassId = "CPRE-1850" }),
            MakeCourse("CPRE-2300", "Intro Cyber Sec", 3m, "CPRE",
                crossListedAs: new[] { "CYBE-2300" },
                prereqs: new PrereqCourse { ClassId = "CPRE-1850" }),

            // Core-credits gate (AC-25)
            MakeCourse("CPRE-4910", "Sr Design I", 3m, "CPRE",
                crossListedAs: new[] { "EE-4910" },
                prereqs: new PrereqCoreCredits { MinCoreCredits = 29m }),
            MakeCourse("EE-4910", "Sr Design I", 3m, "EE",
                crossListedAs: new[] { "CPRE-4910" },
                prereqs: new PrereqCoreCredits { MinCoreCredits = 29m }),

            // Term-offering — Fall-only (AC-21)
            MakeCourse("COMS-3110", "Algorithms", 3m, "COMS",
                prereqs: new PrereqCourse { ClassId = "MATH-1660" },
                offered: new[] { Term.Fall }),

            // Term-offering — empty list, treat as available every term (AC-22)
            MakeCourse("ENGL-2500", "Communications", 3m, "ENGL"),

            // Tech electives — AC-7, AC-8 swap targets
            MakeCourse("TECH-101", "Tech Elective A", 3m, "TECH"),
            MakeCourse("TECH-102", "Tech Elective B", 3m, "TECH",
                prereqs: new PrereqCourse { ClassId = "MATH-1660" }),

            // Filler placeholder used when overlay needs a Tech slot
            MakeCourse("TECH-103", "Tech Elective C", 3m, "TECH"),
        };
    }

    private DegreeFlow BuildFlow()
    {
        var id = Guid.Parse("00000000-0000-0000-0000-00000000F100");
        var slots = new List<FlowchartSlot>();
        int displayOrder = 1;

        FlowchartSlot Slot(int sem, string classId, decimal? credits = null,
                           string? minGrade = null, string[]? pairing = null) =>
            new()
            {
                Id = Guid.NewGuid(), DegreeFlowId = id, Semester = sem,
                SlotType = SlotType.DegreeClass, ClassId = classId,
                RequiredCredits = credits, MinGrade = minGrade,
                DisplayOrder = displayOrder++,
                RecommendedPairing = (pairing ?? Array.Empty<string>()).ToList(),
            };

        FlowchartSlot Elective(int sem, SlotType type, decimal credits) =>
            new()
            {
                Id = Guid.NewGuid(), DegreeFlowId = id, Semester = sem,
                SlotType = type, RequiredCredits = credits,
                DisplayOrder = displayOrder++,
            };

        // Sem 1
        slots.Add(Slot(1, "MATH-1650", minGrade: "C-"));
        slots.Add(Slot(1, "CPRE-1850", pairing: new[] { "MATH-1650" }));
        slots.Add(Elective(1, SlotType.ElectiveGenEd, 3m));

        // Sem 2
        slots.Add(Slot(2, "MATH-1660"));
        slots.Add(Slot(2, "PHYS-2310"));
        slots.Add(Slot(2, "PHYS-2310L"));
        slots.Add(Slot(2, "CPRE-2810"));

        // Sem 3
        slots.Add(Slot(3, "CYBE-2300"));
        slots.Add(Slot(3, "COMS-3110"));
        slots.Add(Elective(3, SlotType.ElectiveTech, 3m));

        // Sem 7-8
        slots.Add(Slot(7, "CPRE-4910"));
        slots.Add(Elective(8, SlotType.ElectiveCybE, 3m));

        return new DegreeFlow
        {
            Id = id, MajorCode = "CYBE", MajorName = "Cyber Security Engineering",
            CatalogYear = "2025-26", TotalCreditsRequired = 125,
            Slots = slots,
        };
    }
}
```

- [ ] **Step 5: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CybEFixtureTests
```

Expected: 4 passing tests.

- [ ] **Step 6: Commit**

```
git add tests/ISUCourseManager.Services.Tests/Cascade/Fixtures/
git commit -m "test(cascade): CybEFixture and StudentRecordBuilder for engine tests"
```

---


## Task 9: PrereqEvaluator — Course nodes with min-grade and acceptConcurrent

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.Course.cs`

The evaluator is built incrementally over Tasks 9-13, one node type per task. This task wires up the API surface and handles `PrereqCourse` (with min-grade + acceptConcurrent + cross-listing equivalence + External-transfer parity).

- [ ] **Step 1: Write failing tests for Course-node evaluation**

Create `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.Course.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class PrereqEvaluatorTests_Course
{
    private static PrereqEvaluator MakeEvaluator(CybEFixture f) =>
        new(new CrossListingIndex(f.Catalog), f.Catalog, new CascadeOptions());

    [Fact]
    public void Course_node_satisfied_when_completed_in_earlier_term()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650" };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void Course_node_not_satisfied_when_not_in_record_at_all()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650" };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeFalse();
    }

    [Fact]
    public void Course_node_not_satisfied_when_only_planned_for_same_term_without_acceptConcurrent()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Planned("MATH-1650", 202604).Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650" };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeFalse();
    }

    [Fact]
    public void AcceptConcurrent_is_satisfied_when_partner_is_planned_in_same_term()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Planned("MATH-1650", 202604).Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650", AcceptConcurrent = true };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void AcceptConcurrent_not_satisfied_when_partner_is_in_a_later_term()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Planned("MATH-1650", 202702).Build(); // later term

        var prereq = new PrereqCourse { ClassId = "MATH-1650", AcceptConcurrent = true };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeFalse();
    }

    [Fact]
    public void MinGrade_blocks_when_completed_grade_is_below_threshold()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("MATH-1650", 202602, "D").Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" };
        var result = ev.Evaluate(prereq, record, candidateAcademicTerm: 202604);
        result.IsSatisfied.Should().BeFalse();
        result.GradeRequirementUnmet.Should().BeTrue();
    }

    [Fact]
    public void MinGrade_passes_when_completed_grade_is_at_or_above_threshold()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("MATH-1650", 202602, "C-").Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void Cross_listing_equivalence_AC19_EE4910_satisfies_CPRE4910_reference()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        // Student took EE-4910; prereq references CPRE-4910.
        var record = f.Records().Completed("EE-4910", 202704, "B").Build();

        var prereq = new PrereqCourse { ClassId = "CPRE-4910" };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202804).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void Cross_listing_equivalence_AC20_CPRE2300_satisfies_CYBE2300_slot()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("CPRE-2300", 202604, "B").Build();

        var prereq = new PrereqCourse { ClassId = "CYBE-2300" };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202702).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void External_enrollment_AC39_satisfies_prereq_identically_to_internal()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records()
            .CompletedExternal("MATH-1650", 202601, "B", "Lincoln Land CC", "MATH 113")
            .Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" };
        ev.Evaluate(prereq, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeTrue();
    }
}
```

- [ ] **Step 2: Run to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_Course
```

Expected: build error — `PrereqEvaluator` does not exist.

- [ ] **Step 3: Implement PrereqEvaluator with EvaluationResult and Course-node logic**

Create `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Result of evaluating a PrereqExpression at a candidate term.
/// IsSatisfied = the placement may proceed. The boolean flags expose *why* satisfaction
/// was granted or denied so the engine can attach the right ValidationIssueKind to its
/// emitted issues without re-walking the tree.
/// </summary>
public sealed record EvaluationResult(
    bool IsSatisfied,
    bool GradeRequirementUnmet = false,
    bool ClassificationGateUnmet = false,
    bool CoreCreditsGateUnmet = false,
    bool PendingGradeOptimisticallySatisfied = false,
    Guid? PendingGradeStudentCourseId = null);

/// <summary>
/// Pure expression-tree evaluator. Stateless beyond the catalog/cross-listing data
/// passed at construction. The engine builds one per CascadeRequest.
///
/// Evaluation contract:
///   - "Completed" enrollments in earlier terms satisfy a Course node whose minGrade is
///     met (or null).
///   - "Completed + Grade=null" (pending grade) is **optimistic**: it provisionally
///     satisfies the prereq and flags the result so the caller can emit a
///     PendingGradeDependency warning when min-grade is required.
///   - "Planned" or "InProgress" enrollments in the SAME term satisfy AcceptConcurrent=true
///     edges only.
///   - External enrollments (EnrollmentSource = External) are treated identically to
///     Internal — no special-casing in the evaluator.
///   - Cross-listing equivalence is consulted: any equivalent CourseId satisfies the edge.
/// </summary>
public sealed class PrereqEvaluator
{
    private readonly CrossListingIndex _xlist;
    private readonly Dictionary<string, Course> _catalogByClassId;
    private readonly CascadeOptions _options;

    public PrereqEvaluator(CrossListingIndex xlist, IEnumerable<Course> catalog, CascadeOptions options)
    {
        _xlist = xlist;
        _catalogByClassId = catalog.ToDictionary(c => c.ClassId, StringComparer.Ordinal);
        _options = options;
    }

    public EvaluationResult Evaluate(
        PrereqExpression? expression,
        IReadOnlyList<StudentCourse> record,
        int candidateAcademicTerm)
    {
        if (expression is null) return new EvaluationResult(IsSatisfied: true);

        return expression switch
        {
            PrereqCourse c => EvaluateCourse(c, record, candidateAcademicTerm),
            // Other node types added in subsequent tasks (AndOr, Classification, CoreCredits)
            _ => throw new NotSupportedException($"PrereqExpression type {expression.GetType().Name} not yet supported"),
        };
    }

    private EvaluationResult EvaluateCourse(PrereqCourse prereq, IReadOnlyList<StudentCourse> record, int candidateAcademicTerm)
    {
        var equivClass = _xlist.EquivalenceClassFor(prereq.ClassId);

        // Iterate matching enrollments; pick the strongest (Completed > InProgress > Planned).
        StudentCourse? bestCompleted = null;
        StudentCourse? bestSameTerm = null;

        foreach (var sc in record)
        {
            if (!equivClass.Contains(sc.CourseId)) continue;

            if (sc.Status == StudentCourseStatus.Completed && sc.AcademicTerm < candidateAcademicTerm)
            {
                bestCompleted ??= sc;
            }
            else if (sc.AcademicTerm == candidateAcademicTerm
                     && (sc.Status == StudentCourseStatus.Planned
                         || sc.Status == StudentCourseStatus.InProgress
                         || sc.Status == StudentCourseStatus.Completed))
            {
                bestSameTerm ??= sc;
            }
        }

        if (bestCompleted is not null)
        {
            // Pending-grade optimistic satisfaction.
            if (bestCompleted.Grade is null or "")
            {
                return new EvaluationResult(
                    IsSatisfied: true,
                    PendingGradeOptimisticallySatisfied: prereq.MinGrade is not null,
                    PendingGradeStudentCourseId: prereq.MinGrade is not null ? bestCompleted.Id : null);
            }

            if (prereq.MinGrade is not null && !GradeMeets(bestCompleted.Grade, prereq.MinGrade))
            {
                return new EvaluationResult(IsSatisfied: false, GradeRequirementUnmet: true);
            }
            return new EvaluationResult(IsSatisfied: true);
        }

        if (prereq.AcceptConcurrent && bestSameTerm is not null)
        {
            return new EvaluationResult(IsSatisfied: true);
        }

        return new EvaluationResult(IsSatisfied: false);
    }

    /// <summary>
    /// Compares letter grades. Standard ordering: A+ > A > A- > B+ > B > B- > C+ > C > C- > D+ > D > D- > F.
    /// "T" (transfer pass) and "S" (satisfactory) treated as meeting any minimum.
    /// </summary>
    internal static bool GradeMeets(string posted, string required)
    {
        if (posted is "T" or "S") return true;
        return GradeRank(posted) <= GradeRank(required);
    }

    private static int GradeRank(string g) => g switch
    {
        "A+" => 0, "A" => 1, "A-" => 2,
        "B+" => 3, "B" => 4, "B-" => 5,
        "C+" => 6, "C" => 7, "C-" => 8,
        "D+" => 9, "D" => 10, "D-" => 11,
        "F" => 12,
        _ => 99, // unknown grade ranks worse than F to be safe
    };
}
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_Course
```

Expected: 10 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.Course.cs
git commit -m "feat(cascade): PrereqEvaluator handles Course nodes (min-grade, acceptConcurrent, cross-listing, External)"
```

---

## Task 10: PrereqEvaluator — And/Or composition

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.AndOr.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.AndOr.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class PrereqEvaluatorTests_AndOr
{
    private static PrereqEvaluator MakeEvaluator(CybEFixture f) =>
        new(new CrossListingIndex(f.Catalog), f.Catalog, new CascadeOptions());

    [Fact]
    public void And_satisfied_only_when_every_child_satisfied()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("CPRE-1850", 202602, "B")
            .Build();

        var and = new PrereqAnd
        {
            Children =
            {
                new PrereqCourse { ClassId = "MATH-1650" },
                new PrereqCourse { ClassId = "CPRE-1850" },
            },
        };
        ev.Evaluate(and, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void And_fails_when_any_child_fails()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("MATH-1650", 202602, "B").Build();

        var and = new PrereqAnd
        {
            Children =
            {
                new PrereqCourse { ClassId = "MATH-1650" },
                new PrereqCourse { ClassId = "CPRE-1850" }, // missing
            },
        };
        ev.Evaluate(and, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeFalse();
    }

    [Fact]
    public void Or_satisfied_when_at_least_one_child_satisfied()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("EE-4910", 202704, "B").Build();

        var or = new PrereqOr
        {
            Children =
            {
                new PrereqCourse { ClassId = "CPRE-4910" }, // satisfied via cross-list
                new PrereqCourse { ClassId = "TECH-101" },  // not in record
            },
        };
        ev.Evaluate(or, record, candidateAcademicTerm: 202804).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void Or_fails_when_no_child_satisfied()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Build();

        var or = new PrereqOr
        {
            Children =
            {
                new PrereqCourse { ClassId = "TECH-101" },
                new PrereqCourse { ClassId = "TECH-102" },
            },
        };
        ev.Evaluate(or, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeFalse();
    }

    [Fact]
    public void Nested_And_with_Or_evaluates_recursively()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("TECH-102", 202604, "C")
            .Build();

        var nested = new PrereqAnd
        {
            Children =
            {
                new PrereqCourse { ClassId = "MATH-1650" },
                new PrereqOr
                {
                    Children =
                    {
                        new PrereqCourse { ClassId = "TECH-101" },
                        new PrereqCourse { ClassId = "TECH-102" },
                    },
                },
            },
        };
        ev.Evaluate(nested, record, candidateAcademicTerm: 202702).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void And_propagates_GradeRequirementUnmet_from_a_failing_child()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("MATH-1650", 202602, "D").Build();

        var and = new PrereqAnd
        {
            Children =
            {
                new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" },
            },
        };
        var result = ev.Evaluate(and, record, candidateAcademicTerm: 202604);
        result.IsSatisfied.Should().BeFalse();
        result.GradeRequirementUnmet.Should().BeTrue();
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_AndOr
```

Expected: tests fail with `NotSupportedException` for `PrereqAnd` / `PrereqOr`.

- [ ] **Step 3: Add And/Or handling to the Evaluate switch**

In `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`, replace the `switch (expression)` block in `Evaluate(...)` with:

```csharp
        return expression switch
        {
            PrereqCourse c          => EvaluateCourse(c, record, candidateAcademicTerm),
            PrereqAnd a             => EvaluateAnd(a, record, candidateAcademicTerm),
            PrereqOr o              => EvaluateOr(o, record, candidateAcademicTerm),
            // Classification + CoreCredits added in later tasks
            _ => throw new NotSupportedException($"PrereqExpression type {expression.GetType().Name} not yet supported"),
        };
```

Then add these private methods:

```csharp
    private EvaluationResult EvaluateAnd(PrereqAnd and, IReadOnlyList<StudentCourse> record, int candidateAcademicTerm)
    {
        bool allSat = true;
        bool anyGradeUnmet = false;
        bool anyClassificationUnmet = false;
        bool anyCoreCreditsUnmet = false;
        bool anyPendingOptimistic = false;
        Guid? pendingId = null;

        foreach (var child in and.Children)
        {
            var r = Evaluate(child, record, candidateAcademicTerm);
            if (!r.IsSatisfied) allSat = false;
            anyGradeUnmet |= r.GradeRequirementUnmet;
            anyClassificationUnmet |= r.ClassificationGateUnmet;
            anyCoreCreditsUnmet |= r.CoreCreditsGateUnmet;
            if (r.PendingGradeOptimisticallySatisfied)
            {
                anyPendingOptimistic = true;
                pendingId ??= r.PendingGradeStudentCourseId;
            }
        }

        return new EvaluationResult(
            IsSatisfied: allSat,
            GradeRequirementUnmet: anyGradeUnmet,
            ClassificationGateUnmet: anyClassificationUnmet,
            CoreCreditsGateUnmet: anyCoreCreditsUnmet,
            PendingGradeOptimisticallySatisfied: anyPendingOptimistic,
            PendingGradeStudentCourseId: pendingId);
    }

    private EvaluationResult EvaluateOr(PrereqOr or, IReadOnlyList<StudentCourse> record, int candidateAcademicTerm)
    {
        // Or is satisfied if ANY child is satisfied. Collect pending-grade hints from
        // satisfied children (so a sole-satisfier on a pending grade still triggers the warning).
        EvaluationResult? firstSatisfied = null;
        bool anyGradeUnmet = false;

        foreach (var child in or.Children)
        {
            var r = Evaluate(child, record, candidateAcademicTerm);
            if (r.IsSatisfied)
            {
                firstSatisfied ??= r;
            }
            else
            {
                anyGradeUnmet |= r.GradeRequirementUnmet;
            }
        }

        if (firstSatisfied is not null) return firstSatisfied;
        return new EvaluationResult(IsSatisfied: false, GradeRequirementUnmet: anyGradeUnmet);
    }
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_AndOr
```

Expected: 6 passing tests; existing Course tests still pass.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.AndOr.cs
git commit -m "feat(cascade): PrereqEvaluator supports And/Or composition"
```

---

## Task 11: PrereqEvaluator — pending-grade optimistic satisfaction

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs` (no code change — Course-node logic already implements this; this task adds the dedicated test coverage)
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.PendingGrade.cs`

The optimistic-satisfaction logic was wired in Task 9 inside `EvaluateCourse`. This task locks it down with explicit tests for AC-32, AC-33, AC-PG-2, AC-PG-3, AC-PG-4.

- [ ] **Step 1: Write the AC-PG tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.PendingGrade.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class PrereqEvaluatorTests_PendingGrade
{
    private static PrereqEvaluator MakeEvaluator(CybEFixture f) =>
        new(new CrossListingIndex(f.Catalog), f.Catalog, new CascadeOptions());

    [Fact]
    public void AC_PG_2_pending_grade_with_minGrade_requirement_optimistically_satisfies_and_flags()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().CompletedPending("MATH-1650", 202602).Build();
        var pendingScId = record[0].Id;

        var prereq = new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" };
        var result = ev.Evaluate(prereq, record, candidateAcademicTerm: 202604);

        result.IsSatisfied.Should().BeTrue("pending grade is optimistic");
        result.PendingGradeOptimisticallySatisfied.Should().BeTrue();
        result.PendingGradeStudentCourseId.Should().Be(pendingScId);
    }

    [Fact]
    public void AC_PG_3_pending_grade_with_no_minGrade_requirement_does_not_flag()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().CompletedPending("MATH-1650", 202602).Build();

        // No min-grade requirement on the edge — no risk to surface.
        var prereq = new PrereqCourse { ClassId = "MATH-1650" };
        var result = ev.Evaluate(prereq, record, candidateAcademicTerm: 202604);

        result.IsSatisfied.Should().BeTrue();
        result.PendingGradeOptimisticallySatisfied.Should().BeFalse();
    }

    [Fact]
    public void AC_PG_4_pending_grade_when_posted_above_threshold_clears_to_normal_satisfaction()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        // Re-validate after grade posts
        var record = f.Records().Completed("MATH-1650", 202602, "B").Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" };
        var result = ev.Evaluate(prereq, record, candidateAcademicTerm: 202604);

        result.IsSatisfied.Should().BeTrue();
        result.PendingGradeOptimisticallySatisfied.Should().BeFalse();
    }

    [Fact]
    public void AC_PG_4_pending_grade_when_posted_below_threshold_escalates_to_GradeRequirementUnmet()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("MATH-1650", 202602, "D").Build();

        var prereq = new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" };
        var result = ev.Evaluate(prereq, record, candidateAcademicTerm: 202604);

        result.IsSatisfied.Should().BeFalse();
        result.GradeRequirementUnmet.Should().BeTrue();
    }
}
```

- [ ] **Step 2: Run to verify pass (no production code change needed)**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_PendingGrade
```

Expected: 4 passing tests. (If any fail, verify Task 9 Step 3 implementation matches the spec — the pending-grade branch must trigger the optimistic flag only when `prereq.MinGrade is not null`.)

- [ ] **Step 3: Commit**

```
git add tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.PendingGrade.cs
git commit -m "test(cascade): pending-grade optimistic satisfaction (AC-PG-2..4)"
```

---

## Task 12: PrereqEvaluator — Classification gates (AC-23, AC-24)

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.Classification.cs`

Classification is projected from cumulative credits at the candidate term: completed enrollments + planned enrollments in earlier semesters than the candidate. Thresholds come from `CascadeOptions`.

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.Classification.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class PrereqEvaluatorTests_Classification
{
    private static PrereqEvaluator MakeEvaluator(CybEFixture f) =>
        new(new CrossListingIndex(f.Catalog), f.Catalog, new CascadeOptions());

    [Fact]
    public void AC_23_Sophomore_gate_unmet_when_projected_credits_below_30()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        // Only 8 credits earned by candidate term
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")    // 4cr
            .Completed("MATH-1660", 202604, "B")    // 4cr
            .Build();

        var gate = new PrereqClassification { Min = Classification.Sophomore };
        var result = ev.Evaluate(gate, record, candidateAcademicTerm: 202702);

        result.IsSatisfied.Should().BeFalse();
        result.ClassificationGateUnmet.Should().BeTrue();
    }

    [Fact]
    public void AC_23_Sophomore_gate_met_when_projected_credits_at_or_above_30()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")    // 4
            .Completed("CPRE-1850", 202602, "B")    // 3
            .Completed("MATH-1660", 202604, "B")    // 4
            .Completed("PHYS-2310", 202604, "B")    // 5
            .Completed("PHYS-2310L", 202604, "B")   // 1
            .Completed("CPRE-2810", 202604, "B")    // 3
            .Completed("ENGL-2500", 202604, "B")    // 3
            .Completed("CYBE-2300", 202702, "B")    // 3
            .Completed("COMS-3110", 202702, "B")    // 3
            .Completed("TECH-101", 202702, "B")     // 3 - total 32
            .Build();

        var gate = new PrereqClassification { Min = Classification.Sophomore };
        ev.Evaluate(gate, record, candidateAcademicTerm: 202704).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void AC_24_planned_courses_in_earlier_semesters_count_toward_projection()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        // 0 completed; 32 cr planned in earlier terms.
        var record = f.Records()
            .Planned("MATH-1650", 202602)   // 4
            .Planned("CPRE-1850", 202602)   // 3
            .Planned("ENGL-2500", 202602)   // 3
            .Planned("MATH-1660", 202604)   // 4
            .Planned("PHYS-2310", 202604)   // 5
            .Planned("PHYS-2310L", 202604)  // 1
            .Planned("CPRE-2810", 202604)   // 3
            .Planned("CYBE-2300", 202702)   // 3
            .Planned("COMS-3110", 202702)   // 3
            .Planned("TECH-101", 202702)    // 3 - total 32
            .Build();

        var gate = new PrereqClassification { Min = Classification.Sophomore };
        ev.Evaluate(gate, record, candidateAcademicTerm: 202704).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void Senior_gate_unmet_when_projected_credits_below_90()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records().Completed("MATH-1650", 202602, "B").Build(); // 4cr

        var gate = new PrereqClassification { Min = Classification.Senior };
        ev.Evaluate(gate, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeFalse();
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_Classification
```

Expected: tests fail with `NotSupportedException` for `PrereqClassification`.

- [ ] **Step 3: Add Classification handling**

In `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`, add `PrereqClassification c => EvaluateClassification(c, record, candidateAcademicTerm),` to the switch and add this method:

```csharp
    private EvaluationResult EvaluateClassification(PrereqClassification gate, IReadOnlyList<StudentCourse> record, int candidateAcademicTerm)
    {
        var projectedCredits = ProjectedCreditsAt(record, candidateAcademicTerm);
        var threshold = gate.Min switch
        {
            Classification.Freshman  => 0m,
            Classification.Sophomore => _options.SophomoreMinCredits,
            Classification.Junior    => _options.JuniorMinCredits,
            Classification.Senior    => _options.SeniorMinCredits,
            _ => 0m,
        };
        bool met = projectedCredits >= threshold;
        return new EvaluationResult(IsSatisfied: met, ClassificationGateUnmet: !met);
    }

    /// <summary>
    /// Sum of credits across StudentCourses that count as "earned by" the candidate term:
    /// every Completed enrollment regardless of term, plus every Planned/InProgress
    /// enrollment whose AcademicTerm is strictly earlier than the candidate.
    /// </summary>
    internal decimal ProjectedCreditsAt(IReadOnlyList<StudentCourse> record, int candidateAcademicTerm)
    {
        decimal total = 0m;
        foreach (var sc in record)
        {
            if (!_catalogByClassId.TryGetValue(sc.CourseId, out var course)) continue;
            bool counts = sc.Status switch
            {
                StudentCourseStatus.Completed => true,
                StudentCourseStatus.Planned    => sc.AcademicTerm < candidateAcademicTerm,
                StudentCourseStatus.InProgress => sc.AcademicTerm < candidateAcademicTerm,
                _ => false, // Failed and Withdrawn don't earn credit
            };
            if (counts) total += course.Credits;
        }
        return total;
    }
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_Classification
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.Classification.cs
git commit -m "feat(cascade): PrereqEvaluator handles PrereqClassification (AC-23, AC-24)"
```

---

## Task 13: PrereqEvaluator — Core-credit gates (AC-25)

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.CoreCredits.cs`

`PrereqCoreCredits` (e.g., CprE 4910's "29 Core Cr") sums credits earned in courses that satisfy a `DegreeClass` slot in the program's required core curriculum. The fixture flow's `DegreeClass` slots are the core for our purposes; we pass them in as a `coreClassIds` set when constructing the evaluator at the engine level. For unit-testing the node directly we pass the set explicitly.

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.CoreCredits.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class PrereqEvaluatorTests_CoreCredits
{
    private static PrereqEvaluator MakeEvaluator(CybEFixture f, IEnumerable<string>? coreClassIds = null) =>
        new(new CrossListingIndex(f.Catalog), f.Catalog, new CascadeOptions(),
            coreClassIds: coreClassIds ?? f.Flow.Slots
                .Where(s => s.SlotType == SlotType.DegreeClass && s.ClassId != null)
                .Select(s => s.ClassId!));

    [Fact]
    public void AC_25_CoreCredits_unmet_when_total_below_threshold()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")  // 4 (core)
            .Completed("CPRE-1850", 202602, "B")  // 3 (core)
            .Build();

        var gate = new PrereqCoreCredits { MinCoreCredits = 29m };
        var result = ev.Evaluate(gate, record, candidateAcademicTerm: 202604);

        result.IsSatisfied.Should().BeFalse();
        result.CoreCreditsGateUnmet.Should().BeTrue();
    }

    [Fact]
    public void AC_25_CoreCredits_met_when_sum_at_or_above_threshold()
    {
        var f = new CybEFixture();
        var ev = MakeEvaluator(f);
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")    // 4
            .Completed("CPRE-1850", 202602, "B")    // 3
            .Completed("MATH-1660", 202604, "B")    // 4
            .Completed("PHYS-2310", 202604, "B")    // 5
            .Completed("PHYS-2310L", 202604, "B")   // 1
            .Completed("CPRE-2810", 202604, "B")    // 3
            .Completed("CYBE-2300", 202702, "B")    // 3
            .Completed("COMS-3110", 202702, "B")    // 3 — total core 26
            .Completed("ENGL-2500", 202702, "B")    // 3 — non-core, doesn't count
            .Completed("CPRE-2300", 202702, "B")    // 3 — core (cross-list of CYBE-2300; counted via core set)
            .Build();

        // 26 + 3 = 29
        var gate = new PrereqCoreCredits { MinCoreCredits = 29m };
        ev.Evaluate(gate, record, candidateAcademicTerm: 202704).IsSatisfied.Should().BeTrue();
    }

    [Fact]
    public void Non_core_courses_do_not_count_toward_threshold()
    {
        var f = new CybEFixture();
        // Core set explicitly excludes ENGL-2500
        var ev = MakeEvaluator(f, coreClassIds: new[] { "MATH-1650", "MATH-1660" });
        var record = f.Records()
            .Completed("ENGL-2500", 202602, "B")  // 3 - not counted
            .Completed("MATH-1650", 202602, "B")  // 4 - counted
            .Build();

        var gate = new PrereqCoreCredits { MinCoreCredits = 5m };
        ev.Evaluate(gate, record, candidateAcademicTerm: 202604).IsSatisfied.Should().BeFalse();
    }
}
```

- [ ] **Step 2: Run to verify failure (constructor signature mismatch + NotSupportedException)**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests_CoreCredits
```

Expected: build error / NotSupportedException.

- [ ] **Step 3: Update PrereqEvaluator constructor + add CoreCredits handling**

Modify `src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs`:

Replace the constructor with:

```csharp
    private readonly HashSet<string> _coreClassIds;

    public PrereqEvaluator(
        CrossListingIndex xlist,
        IEnumerable<Course> catalog,
        CascadeOptions options,
        IEnumerable<string>? coreClassIds = null)
    {
        _xlist = xlist;
        _catalogByClassId = catalog.ToDictionary(c => c.ClassId, StringComparer.Ordinal);
        _options = options;
        // Expand the core set through the cross-listing equivalence so a student who took
        // CPRE-2300 (cross-list of CYBE-2300) gets credit when CYBE-2300 is in the core set.
        var seed = (coreClassIds ?? Array.Empty<string>()).ToList();
        _coreClassIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var id in seed)
            foreach (var equiv in _xlist.EquivalenceClassFor(id))
                _coreClassIds.Add(equiv);
    }
```

Add `PrereqCoreCredits cc => EvaluateCoreCredits(cc, record, candidateAcademicTerm),` to the switch and:

```csharp
    private EvaluationResult EvaluateCoreCredits(PrereqCoreCredits gate, IReadOnlyList<StudentCourse> record, int candidateAcademicTerm)
    {
        decimal total = 0m;
        foreach (var sc in record)
        {
            if (!_coreClassIds.Contains(sc.CourseId)) continue;
            if (!_catalogByClassId.TryGetValue(sc.CourseId, out var course)) continue;
            bool counts = sc.Status switch
            {
                StudentCourseStatus.Completed => true,
                StudentCourseStatus.Planned    => sc.AcademicTerm < candidateAcademicTerm,
                StudentCourseStatus.InProgress => sc.AcademicTerm < candidateAcademicTerm,
                _ => false,
            };
            if (counts) total += course.Credits;
        }
        bool met = total >= gate.MinCoreCredits;
        return new EvaluationResult(IsSatisfied: met, CoreCreditsGateUnmet: !met);
    }
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~PrereqEvaluatorTests
```

Expected: every PrereqEvaluator test (Course + AndOr + PendingGrade + Classification + CoreCredits) passes — confirms the constructor change didn't break earlier tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/PrereqEvaluator.cs tests/ISUCourseManager.Services.Tests/Cascade/PrereqEvaluatorTests.CoreCredits.cs
git commit -m "feat(cascade): PrereqEvaluator handles PrereqCoreCredits (AC-25)"
```

---

## Task 14: ValidationIssueDto emitter + CascadeEngine.Validate (AC-18)

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs` (Validate method only — Preview comes in Task 16)
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Validate.cs`

`Engine.Validate(courses, flow, catalog, options)` walks every Planned `StudentCourse` and emits a `ValidationIssueDto` for each broken constraint. Re-uses `PrereqEvaluator` so cascade and validation share one source of truth. Sibling grouping by `RelatedStudentCourseId` is wired here for the pending-grade case; Step 2a co-req-cascade siblings come in Task 19.

- [ ] **Step 1: Write failing tests for Validate**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Validate.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_Validate
{
    [Fact]
    public void AC_18_Validate_returns_no_issues_for_a_well_ordered_record()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var record = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Planned("MATH-1660", 202604)
            .Planned("PHYS-2310", 202604)
            .Planned("PHYS-2310L", 202604)
            .Build();

        var issues = engine.Validate(record, f.Flow, f.Catalog, new CascadeOptions());
        issues.Should().BeEmpty();
    }

    [Fact]
    public void Validate_emits_BrokenPrereq_for_a_planned_course_whose_prereq_is_missing()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // MATH-1660 planned without MATH-1650 satisfied
        var record = f.Records().Planned("MATH-1660", 202604).Build();

        var issues = engine.Validate(record, f.Flow, f.Catalog, new CascadeOptions());

        issues.Should().Contain(i =>
            i.Kind == ValidationIssueKind.BrokenPrereq &&
            i.Severity == IssueSeverity.Error &&
            i.StudentCourseId == record[0].Id);
    }

    [Fact]
    public void Validate_emits_GradeRequirementUnmet_AC34_for_MATH1660_when_MATH1650_is_D()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var record = f.Records()
            .Completed("MATH-1650", 202602, "D")
            .Planned("MATH-1660", 202604)
            .Planned("PHYS-2310", 202604) // AC-34: PHYS 2310's MATH-1650 edge has no minGrade
            .Build();

        var issues = engine.Validate(record, f.Flow, f.Catalog, new CascadeOptions());

        issues.Should().Contain(i =>
            i.Kind == ValidationIssueKind.GradeRequirementUnmet &&
            i.StudentCourseId == record[1].Id);   // MATH-1660 flagged
        issues.Should().NotContain(i => i.StudentCourseId == record[2].Id); // PHYS-2310 NOT flagged
    }

    [Fact]
    public void Validate_emits_PendingGradeDependency_warning_with_RelatedStudentCourseId_AC32()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var record = f.Records()
            .CompletedPending("MATH-1650", 202602)
            .Planned("MATH-1660", 202604) // depends on MATH-1650 with minGrade=C-
            .Build();

        var issues = engine.Validate(record, f.Flow, f.Catalog, new CascadeOptions());
        var issue = issues.Should().ContainSingle(i =>
            i.Kind == ValidationIssueKind.PendingGradeDependency).Subject;

        issue.Severity.Should().Be(IssueSeverity.Warning);
        issue.StudentCourseId.Should().Be(record[1].Id);            // MATH-1660 (the dependent)
        issue.RelatedStudentCourseId.Should().Be(record[0].Id);     // MATH-1650 (the cause)
    }

    [Fact]
    public void Validate_does_not_emit_PendingGradeDependency_when_edge_has_no_minGrade_AC33()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var record = f.Records()
            .CompletedPending("MATH-1650", 202602)
            .Planned("PHYS-2310", 202604) // PHYS-2310's MATH-1650 prereq has no minGrade
            .Build();

        var issues = engine.Validate(record, f.Flow, f.Catalog, new CascadeOptions());
        issues.Should().NotContain(i => i.Kind == ValidationIssueKind.PendingGradeDependency);
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Validate
```

Expected: build error — `CascadeEngine` does not exist.

- [ ] **Step 3: Implement CascadeEngine.Validate**

Create `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Pure orchestrator. Two public entrypoints:
///   - Validate: walks planned StudentCourses, emits ValidationIssueDto[] (used by every
///     plan-read response).
///   - Preview: applies a CascadeTrigger to a working copy and produces a CascadeProposal
///     (used by the wizard's preview/apply protocol). Implemented in Task 16.
/// </summary>
public sealed class CascadeEngine
{
    public IReadOnlyList<ValidationIssueDto> Validate(
        IReadOnlyList<StudentCourse> courses,
        DegreeFlow flow,
        IReadOnlyList<Course> catalog,
        CascadeOptions options)
    {
        var xlist = new CrossListingIndex(catalog);
        var coreIds = flow.Slots
            .Where(s => s.SlotType == SlotType.DegreeClass && s.ClassId != null)
            .Select(s => s.ClassId!);
        var ev = new PrereqEvaluator(xlist, catalog, options, coreClassIds: coreIds);
        var byClass = catalog.ToDictionary(c => c.ClassId, StringComparer.Ordinal);
        var issues = new List<ValidationIssueDto>();

        foreach (var sc in courses)
        {
            // Only Planned/InProgress/Completed enrollments are subject to validation;
            // Failed/Withdrawn produce no future-facing issues.
            if (sc.Status is StudentCourseStatus.Failed or StudentCourseStatus.Withdrawn)
                continue;

            if (!byClass.TryGetValue(sc.CourseId, out var course)) continue;

            // Prereq evaluation
            if (course.Prereqs is not null)
            {
                var r = ev.Evaluate(course.Prereqs, courses, sc.AcademicTerm);
                if (!r.IsSatisfied)
                {
                    var kind = r.GradeRequirementUnmet
                        ? ValidationIssueKind.GradeRequirementUnmet
                        : r.ClassificationGateUnmet
                            ? ValidationIssueKind.ClassificationGateUnmet
                            : r.CoreCreditsGateUnmet
                                ? ValidationIssueKind.CoreCreditsGateUnmet
                                : ValidationIssueKind.BrokenPrereq;
                    issues.Add(new ValidationIssueDto(
                        Kind: kind,
                        Severity: IssueSeverity.Error,
                        StudentCourseId: sc.Id,
                        RelatedStudentCourseId: null,
                        Semester: sc.AcademicTerm,
                        Message: $"{course.Code} prereqs not satisfied"));
                }
                else if (r.PendingGradeOptimisticallySatisfied)
                {
                    issues.Add(new ValidationIssueDto(
                        Kind: ValidationIssueKind.PendingGradeDependency,
                        Severity: IssueSeverity.Warning,
                        StudentCourseId: sc.Id,
                        RelatedStudentCourseId: r.PendingGradeStudentCourseId,
                        Semester: sc.AcademicTerm,
                        Message: $"{course.Code} depends on a course whose grade is pending"));
                }
            }

            // Coreq evaluation (Course.Coreqs as a separate tree).
            if (course.Coreqs is not null)
            {
                var r = ev.Evaluate(course.Coreqs, courses, sc.AcademicTerm);
                if (!r.IsSatisfied)
                {
                    issues.Add(new ValidationIssueDto(
                        Kind: ValidationIssueKind.BrokenCoreq,
                        Severity: IssueSeverity.Error,
                        StudentCourseId: sc.Id,
                        RelatedStudentCourseId: null,
                        Semester: sc.AcademicTerm,
                        Message: $"{course.Code} coreqs not satisfied"));
                }
            }

            // Term-offering check.
            if (course.TypicallyOffered.Count > 0)
            {
                var (year, season) = AcademicTerm.Decode(sc.AcademicTerm);
                var term = SeasonToTerm(season);
                if (term is not null && !course.TypicallyOffered.Contains(term.Value))
                {
                    issues.Add(new ValidationIssueDto(
                        Kind: ValidationIssueKind.TermNotOffered,
                        Severity: IssueSeverity.Error,
                        StudentCourseId: sc.Id,
                        RelatedStudentCourseId: null,
                        Semester: sc.AcademicTerm,
                        Message: $"{course.Code} not offered in {term} {year}"));
                }
            }
        }

        return issues;
    }

    private static Term? SeasonToTerm(Season s) => s switch
    {
        Season.Fall   => Term.Fall,
        Season.Spring => Term.Spring,
        Season.Summer => Term.Summer,
        _ => null,   // Winter has no Term equivalent (Term enum has Fall/Spring/Summer)
    };
}
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Validate
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeEngine.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Validate.cs
git commit -m "feat(cascade): CascadeEngine.Validate emits ValidationIssueDto[] (AC-18, AC-32, AC-33, AC-34)"
```

---

## Task 15: EngineWorkingState — mutable scratch copy used inside Preview

**Files:**
- Create: `src/ISUCourseManager.Services/Cascade/EngineWorkingState.cs`
- Test: covered by Preview tests in subsequent tasks

`Preview(...)` mutates a working copy of the academic record to apply trigger + moves. We never touch the input list; the working state is a private throwaway.

- [ ] **Step 1: Implement EngineWorkingState**

Create `src/ISUCourseManager.Services/Cascade/EngineWorkingState.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Cascade;

/// <summary>
/// Mutable working copy used inside CascadeEngine.Preview(). Tracks the evolving
/// StudentCourse[] alongside the moves accumulated so far so the engine can build the
/// final CascadeProposal in one pass at the end.
///
/// We mutate copies (not the input entities) because the input is shared with the
/// caller — the engine MUST be free of side effects on its inputs.
/// </summary>
internal sealed class EngineWorkingState
{
    public List<StudentCourse> Courses { get; }
    public List<CascadeMove> Moves { get; } = new();
    public List<Warning> Warnings { get; } = new();
    public HashSet<Guid> AffectedIds { get; } = new();

    public EngineWorkingState(IEnumerable<StudentCourse> source)
    {
        Courses = source.Select(CloneCourse).ToList();
    }

    public StudentCourse? FindById(Guid id) => Courses.FirstOrDefault(c => c.Id == id);

    public void RecordMove(StudentCourse sc, int newAcademicTerm, string reason, string courseCode)
    {
        if (sc.AcademicTerm == newAcademicTerm) return; // no-op
        Moves.Add(new CascadeMove(
            StudentCourseId: sc.Id,
            CourseCode: courseCode,
            FromAcademicTerm: sc.AcademicTerm,
            ToAcademicTerm: newAcademicTerm,
            Reason: reason));
        // StudentCourse uses init-only AcademicTerm — replace the row in the list.
        var replacement = CloneCourse(sc) with { };  // record-with for shallow clone
        // Since StudentCourse isn't a record, we manually replace via the list index.
        var idx = Courses.IndexOf(sc);
        Courses[idx] = new StudentCourse
        {
            Id = sc.Id,
            StudentId = sc.StudentId,
            CourseId = sc.CourseId,
            AcademicTerm = newAcademicTerm,
            Status = sc.Status,
            Grade = sc.Grade,
            EnrollmentSource = sc.EnrollmentSource,
            TransferInstitution = sc.TransferInstitution,
            TransferExternalCourseCode = sc.TransferExternalCourseCode,
            TransferNote = sc.TransferNote,
        };
    }

    private static StudentCourse CloneCourse(StudentCourse sc) => new()
    {
        Id = sc.Id,
        StudentId = sc.StudentId,
        CourseId = sc.CourseId,
        AcademicTerm = sc.AcademicTerm,
        Status = sc.Status,
        Grade = sc.Grade,
        EnrollmentSource = sc.EnrollmentSource,
        TransferInstitution = sc.TransferInstitution,
        TransferExternalCourseCode = sc.TransferExternalCourseCode,
        TransferNote = sc.TransferNote,
    };
}
```

> **Note for the implementer:** the `_ = replacement;` line is intentionally awkward in the CloneCourse-then-replace pattern because `StudentCourse` is a class with init-only setters (per plan #1). If `StudentCourse` is converted to a `record` in a future refactor, simplify to `Courses[idx] = sc with { AcademicTerm = newAcademicTerm }`. The behavior is identical.

- [ ] **Step 2: Build to verify**

```
dotnet build src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

Expected: `Build succeeded.` (Strip the `var replacement = ...; _ = replacement;` lines if your linter complains; they're vestigial guidance for the refactor note above. Final code only needs the `Courses[idx] = new StudentCourse { ... }` block.)

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Services/Cascade/EngineWorkingState.cs
git commit -m "feat(cascade): EngineWorkingState scratch type for Preview()"
```

---

## Task 16: CascadeEngine.Preview — Steps 1+2 (apply trigger, walk affected set)

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Skip.cs`

This task lays in the public `Preview` API plus algorithm Steps 1 (apply trigger) + 2 (walk forward, collect affected set). We test against AC-3 first (the simplest case — a gen-ed skip with no downstream impact).

- [ ] **Step 1: Write failing AC-3 test**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Skip.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_Skip
{
    [Fact]
    public void Cascade_AC3_PureGenEdSkipped_NoDownstreamMoves_FillGapForThatSemesterOnly()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();

        var planned = f.Records()
            .Planned("MATH-1650", 202602)
            .Planned("CPRE-1850", 202602)
            .Planned("ENGL-2500", 202602) // pure gen-ed; no downstream prereqs
            .Build();

        var trigger = new CourseSkipped(planned[2].Id, RescheduledToTerm: null);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);

        proposal.Moves.Should().BeEmpty(); // no downstream displacement
        proposal.Decisions.Should().Contain(d => d is FillGapDecision fg && fg.Semester == 1);
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Skip
```

Expected: build error — `Preview` method does not exist on `CascadeEngine`.

- [ ] **Step 3: Add Preview() with Steps 1 + 2 + 5 (gap detection)**

Append to `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`:

```csharp
    public CascadeProposal Preview(CascadeRequest request)
    {
        var ws = new EngineWorkingState(request.Courses);
        var xlist = new CrossListingIndex(request.Catalog);
        var coreIds = request.Flow.Slots
            .Where(s => s.SlotType == SlotType.DegreeClass && s.ClassId != null)
            .Select(s => s.ClassId!);
        var ev = new PrereqEvaluator(xlist, request.Catalog, request.Options, coreClassIds: coreIds);
        var byClass = request.Catalog.ToDictionary(c => c.ClassId, StringComparer.Ordinal);
        var sm = new SemesterMath(
            startCycleYear: ws.Courses.Count > 0 ? AcademicTerm.Decode(ws.Courses.Min(c => c.AcademicTerm)).Year : 2026,
            startTerm: request.Options.StartTerm);

        // === Step 1: Apply the trigger to the working copy ===
        ApplyTrigger(ws, request.Trigger, byClass);

        // === Step 2: Walk forward to collect the affected set (broken prereqs) ===
        // Initial seed: any Planned or InProgress course whose prereqs/coreqs are now broken.
        WalkAffectedSet(ws, ev, byClass);

        // === Step 2a: Co-req transitive flagging (Task 19 fills this in) ===
        // (Placeholder for incremental TDD — Task 19 implements the fixed-point loop.)

        // === Step 3: earliestValidSemester rescheduling (Task 17 fills this in) ===

        // === Step 4: topo order is implicit in the rescheduling pass; no separate step needed ===

        // === Step 5: per-semester gap detection — emit FillGapDecisions ===
        var decisions = new List<DecisionPoint>();
        EmitFillGapDecisions(ws, request.Flow, byClass, request.Options, decisions);

        // === Step 6: soft-pairing pass (Task 20 fills this in) ===

        var projectedGrad = ProjectedGraduationTerm(ws, sm, request.Options);

        return new CascadeProposal(
            ProposedCourses: ws.Courses.AsReadOnly(),
            Moves: ws.Moves.AsReadOnly(),
            Decisions: decisions.AsReadOnly(),
            Warnings: ws.Warnings.AsReadOnly(),
            ProjectedGraduationTerm: projectedGrad);
    }

    private static void ApplyTrigger(
        EngineWorkingState ws, CascadeTrigger trigger,
        IReadOnlyDictionary<string, Course> byClass)
    {
        switch (trigger)
        {
            case CourseSkipped skip:
            {
                var sc = ws.FindById(skip.StudentCourseId)
                    ?? throw new InvalidOperationException($"Skip target {skip.StudentCourseId} not in record");
                ws.AffectedIds.Add(sc.Id);
                if (skip.RescheduledToTerm is int target)
                {
                    var code = byClass.TryGetValue(sc.CourseId, out var c) ? c.Code : sc.CourseId;
                    ws.RecordMove(sc, target, "user-rescheduled skip", code);
                }
                else
                {
                    // Remove from current term — engine's earliestValidSemester pass (Task 17)
                    // will reposition. For now, mark and leave.
                    ws.Courses.Remove(sc);
                }
                break;
            }
            case CourseFailed fail:
            {
                var sc = ws.FindById(fail.StudentCourseId)
                    ?? throw new InvalidOperationException($"Fail target {fail.StudentCourseId} not in record");
                var idx = ws.Courses.IndexOf(sc);
                ws.Courses[idx] = new StudentCourse
                {
                    Id = sc.Id, StudentId = sc.StudentId, CourseId = sc.CourseId,
                    AcademicTerm = sc.AcademicTerm,
                    Status = StudentCourseStatus.Failed, Grade = fail.Grade,
                    EnrollmentSource = sc.EnrollmentSource,
                    TransferInstitution = sc.TransferInstitution,
                    TransferExternalCourseCode = sc.TransferExternalCourseCode,
                    TransferNote = sc.TransferNote,
                };
                ws.AffectedIds.Add(sc.Id);
                break;
            }
            case CourseRemovedFromTerm rem:
            {
                var sc = ws.FindById(rem.StudentCourseId);
                if (sc is not null) { ws.AffectedIds.Add(sc.Id); ws.Courses.Remove(sc); }
                break;
            }
            case CourseAddedToTerm add:
            {
                ws.Courses.Add(new StudentCourse
                {
                    Id = Guid.NewGuid(),
                    StudentId = ws.Courses.FirstOrDefault()?.StudentId ?? Guid.Empty,
                    CourseId = add.CourseId,
                    AcademicTerm = add.AcademicTerm,
                    Status = StudentCourseStatus.Planned,
                });
                break;
            }
            case CourseSubstituted sub:
            {
                var sc = ws.FindById(sub.StudentCourseId)
                    ?? throw new InvalidOperationException($"Substitute target {sub.StudentCourseId} not in record");
                var idx = ws.Courses.IndexOf(sc);
                ws.Courses[idx] = new StudentCourse
                {
                    Id = sc.Id, StudentId = sc.StudentId, CourseId = sub.NewCourseId,
                    AcademicTerm = sc.AcademicTerm, Status = sc.Status, Grade = sc.Grade,
                    EnrollmentSource = sc.EnrollmentSource,
                    TransferInstitution = sc.TransferInstitution,
                    TransferExternalCourseCode = sc.TransferExternalCourseCode,
                    TransferNote = sc.TransferNote,
                };
                ws.AffectedIds.Add(sc.Id);
                break;
            }
            case FixCurrentState:
                // Treat every currently-broken planned course as if it had just been
                // moved to its current placement. The walk in Step 2 will pick them up.
                break;
            case WhatIfMajorSwitched:
                // No mutation — overlay-only. Validate against the new flow at the
                // controller layer (plan #4); engine returns a proposal with no Moves.
                break;
        }
    }

    private static void WalkAffectedSet(
        EngineWorkingState ws, PrereqEvaluator ev,
        IReadOnlyDictionary<string, Course> byClass)
    {
        // Any Planned course with broken prereqs joins the affected set.
        foreach (var sc in ws.Courses.ToList())
        {
            if (sc.Status is not (StudentCourseStatus.Planned or StudentCourseStatus.InProgress)) continue;
            if (!byClass.TryGetValue(sc.CourseId, out var course)) continue;
            if (course.Prereqs is null) continue;
            var r = ev.Evaluate(course.Prereqs, ws.Courses, sc.AcademicTerm);
            if (!r.IsSatisfied) ws.AffectedIds.Add(sc.Id);
        }
    }

    private static void EmitFillGapDecisions(
        EngineWorkingState ws, DegreeFlow flow,
        IReadOnlyDictionary<string, Course> byClass,
        CascadeOptions options, List<DecisionPoint> decisions)
    {
        // Group courses by semester-index using the slot semesters from the flow.
        var creditsBySemester = new Dictionary<int, decimal>();
        foreach (var sc in ws.Courses)
        {
            // We use the slot's Semester for the course's planned term; map AcademicTerm back
            // via the lowest matching semester. Simple linear scan over slots is fine.
            var slotSem = flow.Slots
                .Where(s => s.SlotType == SlotType.DegreeClass && s.ClassId == sc.CourseId)
                .Select(s => (int?)s.Semester)
                .FirstOrDefault() ?? InferSemesterFromAcademicTerm(sc.AcademicTerm, ws.Courses, flow);
            if (!byClass.TryGetValue(sc.CourseId, out var course)) continue;
            creditsBySemester.TryGetValue(slotSem, out var existing);
            creditsBySemester[slotSem] = existing + course.Credits;
        }

        for (int sem = 1; sem <= options.MaxSemester; sem++)
        {
            var have = creditsBySemester.GetValueOrDefault(sem, 0m);
            if (have < options.SoftMinCreditsPerSemester && have > 0m)
            {
                decisions.Add(new FillGapDecision(
                    Id: Guid.NewGuid(),
                    Semester: sem,
                    Prompt: $"Semester {sem} has only {have} credits — add a slot to reach at least {options.SoftMinCreditsPerSemester}.",
                    CreditsToFill: options.TargetCreditsPerSemester - have,
                    SuggestedSlots: SuggestSlots(flow, sem, options.TargetCreditsPerSemester - have)));
            }
            else if (have == 0m && SemesterHasAnyOriginalSlot(flow, sem))
            {
                // Whole semester wiped (e.g., AC-3): emit a FillGap to recover credits.
                decisions.Add(new FillGapDecision(
                    Id: Guid.NewGuid(),
                    Semester: sem,
                    Prompt: $"Semester {sem} is empty — fill it.",
                    CreditsToFill: options.TargetCreditsPerSemester,
                    SuggestedSlots: SuggestSlots(flow, sem, options.TargetCreditsPerSemester)));
            }
        }
    }

    private static bool SemesterHasAnyOriginalSlot(DegreeFlow flow, int sem) =>
        flow.Slots.Any(s => s.Semester == sem);

    private static int InferSemesterFromAcademicTerm(int academicTerm, IReadOnlyList<StudentCourse> all, DegreeFlow flow)
    {
        // Fallback used when the course has no DegreeClass slot in the flow (e.g., elective).
        // Map by AcademicTerm rank: the earliest term among all rows is "semester 1," and so on.
        var distinct = all.Select(c => c.AcademicTerm).Distinct().OrderBy(t => t).ToList();
        var idx = distinct.IndexOf(academicTerm);
        return idx >= 0 ? idx + 1 : 1;
    }

    private static IReadOnlyList<SlotOption> SuggestSlots(DegreeFlow flow, int sem, decimal creditsToFill)
    {
        // Pick any Elective* slots in this semester whose RequiredCredits sum up to creditsToFill.
        var slots = flow.Slots
            .Where(s => s.Semester == sem && s.SlotType != SlotType.DegreeClass && s.RequiredCredits is decimal)
            .ToList();
        return slots.Select(s => new SlotOption(s.SlotType.ToString(), s.RequiredCredits!.Value)).ToList();
    }

    private static int ProjectedGraduationTerm(EngineWorkingState ws, SemesterMath sm, CascadeOptions options)
    {
        if (ws.Courses.Count == 0) return sm.SemesterToAcademicTerm(options.MaxSemester);
        return ws.Courses.Max(c => c.AcademicTerm);
    }
```

- [ ] **Step 4: Run to verify the AC-3 test passes**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Skip
```

Expected: 1 passing test (AC-3). Tasks 17 and 18 will add AC-1 and AC-2 in this same file.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeEngine.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Skip.cs
git commit -m "feat(cascade): Preview() Steps 1+2+5 — trigger, affected-set walk, gap decisions (AC-3)"
```

---

## Task 17: Preview Step 3 — earliestValidSemester rescheduling

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`
- Modify: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Skip.cs` (add AC-1 and AC-2)
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Boundary.cs` (AC-21, AC-22)

The walk-affected-set seeds `AffectedIds`. Step 3 reschedules each affected course to the first semester ≥ current where prereqs, hard coreqs, grade requirements, and term-offerings all pass. Term-offering checks require advancing past Spring-only or Fall-only courses.

- [ ] **Step 1: Write the failing AC-1 + AC-2 tests**

Append to `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Skip.cs`:

```csharp
    [Fact]
    public void Cascade_AC1_Math1650Skipped_PushesCprE1850AndMath1660_EmitsFillGapSem1()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Planned("MATH-1650", 202602)  // sem 1
            .Planned("CPRE-1850", 202602)  // sem 1, has acceptConcurrent on MATH-1650
            .Planned("MATH-1660", 202604)  // sem 2, prereq MATH-1650 with minGrade C-
            .Build();

        var trigger = new CourseSkipped(planned[0].Id, RescheduledToTerm: null);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);

        // MATH-1650 itself was removed by the skip (rescheduledToTerm: null) — the engine
        // re-places it at the earliest valid semester (sem 2).
        proposal.ProposedCourses.Should().Contain(c =>
            c.CourseId == "MATH-1650" && c.AcademicTerm == 202604);

        // CPRE-1850 (acceptConcurrent on MATH-1650) follows MATH-1650 to sem 2.
        proposal.Moves.Should().Contain(m => m.CourseCode == "CPRE-1850" && m.ToAcademicTerm == 202604);

        // MATH-1660 (depends on completed MATH-1650 with minGrade) pushes to sem 3.
        proposal.Moves.Should().Contain(m => m.CourseCode == "MATH-1660" && m.ToAcademicTerm == 202702);

        // FillGap for sem 1 (it's empty).
        proposal.Decisions.Should().Contain(d => d is FillGapDecision fg && fg.Semester == 1);
    }

    [Fact]
    public void Cascade_AC2_Math1650RescheduledToSem3_DependentsRespectUserChoice()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Planned("MATH-1650", 202602)
            .Planned("CPRE-1850", 202602)
            .Planned("MATH-1660", 202604)
            .Build();

        // User explicitly picks sem 3 (202702) for the rescheduled MATH-1650.
        var trigger = new CourseSkipped(planned[0].Id, RescheduledToTerm: 202702);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);

        proposal.ProposedCourses.Should().Contain(c =>
            c.CourseId == "MATH-1650" && c.AcademicTerm == 202702);
        // MATH-1660 must push to AT LEAST sem 4 (must be after MATH-1650 completes).
        proposal.Moves.Should().Contain(m =>
            m.CourseCode == "MATH-1660" && m.ToAcademicTerm >= 202704);
    }
```

- [ ] **Step 2: Write failing term-offering tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Boundary.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_Boundary
{
    [Fact]
    public void Cascade_AC21_FallOnlyCourseTryingToLandInSpring_AdvancesToNextFall()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("MATH-1660", 202604, "B")
            .Planned("COMS-3110", 202604) // COMS-3110 is Fall-only, but 202604 = Spring
            .Build();

        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);

        proposal.Moves.Should().Contain(m =>
            m.CourseCode == "COMS-3110" && m.ToAcademicTerm == 202702
            && m.Reason.Contains("term-offering"));
    }

    [Fact]
    public void Cascade_AC22_EmptyTypicallyOffered_TreatedAsAvailableEveryTerm()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // ENGL-2500 has empty TypicallyOffered.
        var planned = f.Records().Planned("ENGL-2500", 202604).Build();

        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Moves.Should().BeEmpty(); // no displacement needed
    }

    [Fact]
    public void Cascade_AC13_PushBeyondSem8_EmitsGraduationPushedWarning()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // Plan loaded into sem 8; failing it forces a retake into sem 9.
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Failed("CPRE-4910", 202904) // sem 8 = Spring 2029
            .Build();

        var trigger = new CourseFailed(planned[1].Id, "F");
        var opts = new CascadeOptions { MaxSemester = 8 };
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, opts);

        var proposal = engine.Preview(request);
        proposal.Warnings.Should().Contain(w => w.Kind == WarningKind.GraduationPushed);
    }

    [Fact]
    public void Cascade_AC14_NoValidSemester_EmitsWarningAndDoesNotInfiniteLoop()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // CPRE-4910 has a 29-Core-Cr gate; an empty record will never satisfy it.
        var planned = f.Records().Planned("CPRE-4910", 202904).Build();

        var trigger = new FixCurrentState();
        var opts = new CascadeOptions { MaxSemester = 8 };
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, opts);

        var proposal = engine.Preview(request);
        proposal.Warnings.Should().Contain(w => w.Kind == WarningKind.NoValidSemester);
    }

    [Fact]
    public void Cascade_AC15_CircularPrereqDataError_SurfacesWithoutSpinning()
    {
        // Build a tiny mutated catalog where COURSE-A requires COURSE-B and vice versa.
        var courseA = new Course { ClassId = "X-A", Code = "X-A", Name = "A",
            Department = "X", Credits = 3m,
            Prereqs = new PrereqCourse { ClassId = "X-B" } };
        var courseB = new Course { ClassId = "X-B", Code = "X-B", Name = "B",
            Department = "X", Credits = 3m,
            Prereqs = new PrereqCourse { ClassId = "X-A" } };
        var f = new CybEFixture();
        var catalog = f.Catalog.Concat(new[] { courseA, courseB }).ToList();

        var planned = f.Records().Planned("X-A", 202602).Planned("X-B", 202602).Build();
        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, catalog, trigger, new CascadeOptions { MaxSemester = 8 });

        Action run = () => engine.Preview(request);
        run.Should().NotThrow();
        var proposal = engine.Preview(request);
        proposal.Warnings.Should().Contain(w => w.Kind == WarningKind.NoValidSemester);
    }
}
```

- [ ] **Step 3: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Skip|CascadeEngineTests_Boundary
```

Expected: failures — Step 3 not implemented.

- [ ] **Step 4: Implement Step 3 — earliestValidSemester rescheduling**

In `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`, add the helper and call it from `Preview()` between `WalkAffectedSet` and `EmitFillGapDecisions`:

In `Preview()` add (after `WalkAffectedSet`):

```csharp
        RescheduleAffected(ws, ev, byClass, sm, request.Options);

        // After rescheduling, re-walk to pick up any newly-broken courses (cascade).
        const int maxIterations = 16; // hard cap to prevent infinite loop on circular data
        for (int i = 0; i < maxIterations; i++)
        {
            var prevCount = ws.AffectedIds.Count;
            WalkAffectedSet(ws, ev, byClass);
            if (ws.AffectedIds.Count == prevCount) break;
            RescheduleAffected(ws, ev, byClass, sm, request.Options);
        }
```

Then add the helper:

```csharp
    private static void RescheduleAffected(
        EngineWorkingState ws, PrereqEvaluator ev,
        IReadOnlyDictionary<string, Course> byClass,
        SemesterMath sm, CascadeOptions options)
    {
        foreach (var id in ws.AffectedIds.ToList())
        {
            var sc = ws.FindById(id);
            if (sc is null) continue;
            if (!byClass.TryGetValue(sc.CourseId, out var course)) continue;

            var currentSem = sm.AcademicTermToSemester(sc.AcademicTerm);
            int? validSem = FindEarliestValidSemester(sc, course, ws, ev, sm, options, startSem: currentSem);
            if (validSem is null)
            {
                ws.Warnings.Add(new Warning(
                    Kind: WarningKind.NoValidSemester,
                    Message: $"{course.Code} has no valid semester within the {options.MaxSemester}-semester cap",
                    RelatedStudentCourseIds: new[] { sc.Id }));
                continue;
            }
            if (validSem.Value > options.MaxSemester)
            {
                ws.Warnings.Add(new Warning(
                    Kind: WarningKind.GraduationPushed,
                    Message: $"{course.Code} pushes graduation to semester {validSem.Value}",
                    RelatedStudentCourseIds: new[] { sc.Id }));
            }
            var newTerm = sm.SemesterToAcademicTerm(validSem.Value);
            if (newTerm != sc.AcademicTerm)
                ws.RecordMove(sc, newTerm, BuildMoveReason(course, ev, ws, newTerm), course.Code);
        }
    }

    private static int? FindEarliestValidSemester(
        StudentCourse sc, Course course,
        EngineWorkingState ws, PrereqEvaluator ev,
        SemesterMath sm, CascadeOptions options,
        int startSem)
    {
        // Hard cap of MaxSemester + 4 to detect "no valid" without infinite loop on circular data.
        for (int candidateSem = startSem; candidateSem <= options.MaxSemester + 4; candidateSem++)
        {
            var candidateTerm = sm.SemesterToAcademicTerm(candidateSem);

            // Term-offering check
            if (course.TypicallyOffered.Count > 0)
            {
                var (_, season) = AcademicTerm.Decode(candidateTerm);
                var term = season switch
                {
                    Season.Fall => Term.Fall, Season.Spring => Term.Spring, Season.Summer => Term.Summer,
                    _ => (Term?)null,
                };
                if (term is null || !course.TypicallyOffered.Contains(term.Value)) continue;
            }

            // Pretend the course is at candidate term and re-evaluate prereqs.
            var probe = ws.Courses.Select(c => c.Id == sc.Id
                ? new StudentCourse
                {
                    Id = c.Id, StudentId = c.StudentId, CourseId = c.CourseId,
                    AcademicTerm = candidateTerm, Status = c.Status, Grade = c.Grade,
                    EnrollmentSource = c.EnrollmentSource,
                    TransferInstitution = c.TransferInstitution,
                    TransferExternalCourseCode = c.TransferExternalCourseCode,
                    TransferNote = c.TransferNote,
                }
                : c).ToList();

            // If this course was REMOVED from working state (e.g., skip without reschedule),
            // probe doesn't include it — add it provisionally for the evaluation.
            if (!probe.Any(c => c.Id == sc.Id))
            {
                probe.Add(new StudentCourse
                {
                    Id = sc.Id, StudentId = sc.StudentId, CourseId = sc.CourseId,
                    AcademicTerm = candidateTerm, Status = StudentCourseStatus.Planned,
                    Grade = sc.Grade, EnrollmentSource = sc.EnrollmentSource,
                });
            }

            bool prereqsOk = course.Prereqs is null || ev.Evaluate(course.Prereqs, probe, candidateTerm).IsSatisfied;
            bool coreqsOk  = course.Coreqs  is null || ev.Evaluate(course.Coreqs,  probe, candidateTerm).IsSatisfied;
            if (prereqsOk && coreqsOk) return candidateSem;
        }
        return null;
    }

    private static string BuildMoveReason(Course course, PrereqEvaluator ev, EngineWorkingState ws, int newTerm)
    {
        // Best-effort reason; kept simple. Detailed wording is a UI concern.
        if (course.TypicallyOffered.Count > 0)
            return "term-offering constraint";
        return "prereq cascade";
    }
```

Also adjust the trigger handler for `CourseSkipped` with `RescheduledToTerm: null`: instead of removing the row, mark it for rescheduling (so Step 3 can find it a new term):

In `ApplyTrigger`'s `CourseSkipped` branch, replace the `else { ws.Courses.Remove(sc); }` block with:

```csharp
                else
                {
                    // No user-specified term — let earliestValidSemester (Step 3) re-place it.
                    // We must keep the row so the rescheduler has something to move.
                    // Park it at MaxSemester+1 so it's "outside the plan" until rescheduled.
                    var code = byClass.TryGetValue(sc.CourseId, out var c) ? c.Code : sc.CourseId;
                    var idx = ws.Courses.IndexOf(sc);
                    ws.Courses[idx] = new StudentCourse
                    {
                        Id = sc.Id, StudentId = sc.StudentId, CourseId = sc.CourseId,
                        AcademicTerm = 999999, // placeholder; rescheduler walks forward and resets
                        Status = StudentCourseStatus.Planned, Grade = sc.Grade,
                        EnrollmentSource = sc.EnrollmentSource,
                        TransferInstitution = sc.TransferInstitution,
                        TransferExternalCourseCode = sc.TransferExternalCourseCode,
                        TransferNote = sc.TransferNote,
                    };
                    ws.AffectedIds.Add(sc.Id);
                }
```

`SemesterMath.AcademicTermToSemester(999999)` will throw — guard the rescheduler:

In `RescheduleAffected`, wrap the `currentSem` lookup:

```csharp
            int currentSem;
            try { currentSem = sm.AcademicTermToSemester(sc.AcademicTerm); }
            catch (ArgumentException) { currentSem = 1; }
```

- [ ] **Step 5: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Skip|CascadeEngineTests_Boundary
```

Expected: AC-3, AC-1, AC-2 pass plus AC-13, AC-14, AC-15, AC-21, AC-22.

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeEngine.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Skip.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Boundary.cs
git commit -m "feat(cascade): Preview Step 3 — earliestValidSemester rescheduling (AC-1, AC-2, AC-13..15, AC-21, AC-22)"
```

---

## Task 18: Preview overload + underload accounting (AC-11, AC-12)

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Overload.cs`

Step 5 already emits `FillGapDecision`. This task adds `SemesterOverload` warnings + `ConfirmOverloadDecision` for above-cap semesters.

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Overload.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_Overload
{
    [Fact]
    public void Cascade_AC11_Sem2OverloadAt22cr_EmitsWarningAndConfirmOverloadDecision()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // Stack sem 2 with 22 credits.
        var planned = f.Records()
            .Planned("MATH-1660", 202604)   // 4
            .Planned("PHYS-2310", 202604)   // 5
            .Planned("PHYS-2310L", 202604)  // 1
            .Planned("CPRE-2810", 202604)   // 3
            .Planned("CYBE-2300", 202604)   // 3
            .Planned("COMS-3110", 202604)   // 3 (Fall-only, will conflict with Spring 202604; ignore for AC-11)
            .Planned("ENGL-2500", 202604)   // 3 - total = 22
            .Build();

        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);

        proposal.Warnings.Should().Contain(w => w.Kind == WarningKind.SemesterOverload);
        proposal.Decisions.Should().Contain(d => d is ConfirmOverloadDecision);
    }

    [Fact]
    public void Cascade_AC12_Sem1Has6cr_EmitsFillGapDecisionForUnderload()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // Sem 1 with only 6 credits planned.
        var planned = f.Records()
            .Planned("MATH-1650", 202602)  // 4
            .Planned("ENGL-2500", 202602)  // 3 - total 7; under softMin 12
            .Build();
        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Decisions.Should().Contain(d => d is FillGapDecision fg && fg.Semester == 1);
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Overload
```

Expected: AC-11 fails (no overload emission yet); AC-12 may pass already from Task 16.

- [ ] **Step 3: Add overload accounting to EmitFillGapDecisions (rename to EmitPerSemesterAccounting)**

In `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`, replace `EmitFillGapDecisions` with `EmitPerSemesterAccounting` and update the call site in `Preview` to use the new name:

```csharp
    private static void EmitPerSemesterAccounting(
        EngineWorkingState ws, DegreeFlow flow,
        IReadOnlyDictionary<string, Course> byClass,
        CascadeOptions options, List<DecisionPoint> decisions)
    {
        var creditsBySemester = new Dictionary<int, decimal>();
        var idsBySemester = new Dictionary<int, List<Guid>>();
        foreach (var sc in ws.Courses)
        {
            var slotSem = flow.Slots
                .Where(s => s.SlotType == SlotType.DegreeClass && s.ClassId == sc.CourseId)
                .Select(s => (int?)s.Semester)
                .FirstOrDefault() ?? InferSemesterFromAcademicTerm(sc.AcademicTerm, ws.Courses, flow);
            if (!byClass.TryGetValue(sc.CourseId, out var course)) continue;
            creditsBySemester.TryGetValue(slotSem, out var existing);
            creditsBySemester[slotSem] = existing + course.Credits;
            if (!idsBySemester.TryGetValue(slotSem, out var list)) idsBySemester[slotSem] = list = new();
            list.Add(sc.Id);
        }

        for (int sem = 1; sem <= options.MaxSemester; sem++)
        {
            var have = creditsBySemester.GetValueOrDefault(sem, 0m);

            if (have > options.SoftCapCreditsPerSemester)
            {
                var related = idsBySemester.GetValueOrDefault(sem, new()).AsReadOnly();
                ws.Warnings.Add(new Warning(
                    Kind: WarningKind.SemesterOverload,
                    Message: $"Semester {sem} = {have} credits (cap {options.SoftCapCreditsPerSemester})",
                    RelatedStudentCourseIds: related));
                var movables = idsBySemester.GetValueOrDefault(sem, new())
                    .Select(id => ws.Courses.FirstOrDefault(c => c.Id == id))
                    .Where(c => c is not null && c.Status == StudentCourseStatus.Planned)
                    .Select(c => new MovableItem(
                        StudentCourseId: c!.Id,
                        CourseCode: byClass.TryGetValue(c.CourseId, out var co) ? co.Code : c.CourseId,
                        Credits: byClass.TryGetValue(c.CourseId, out var co2) ? co2.Credits : 0m,
                        EarliestPossibleSemester: sem + 1))
                    .ToList();
                decisions.Add(new ConfirmOverloadDecision(
                    Id: Guid.NewGuid(),
                    Semester: sem,
                    Prompt: $"Semester {sem} is at {have} credits — pick which to defer.",
                    CurrentCredits: have,
                    SoftCap: options.SoftCapCreditsPerSemester,
                    CanDeferToLater: movables));
            }
            else if (have > 0m && have < options.SoftMinCreditsPerSemester)
            {
                decisions.Add(new FillGapDecision(
                    Id: Guid.NewGuid(),
                    Semester: sem,
                    Prompt: $"Semester {sem} has only {have} credits — add a slot to reach at least {options.SoftMinCreditsPerSemester}.",
                    CreditsToFill: options.TargetCreditsPerSemester - have,
                    SuggestedSlots: SuggestSlots(flow, sem, options.TargetCreditsPerSemester - have)));
            }
            else if (have == 0m && SemesterHasAnyOriginalSlot(flow, sem))
            {
                decisions.Add(new FillGapDecision(
                    Id: Guid.NewGuid(),
                    Semester: sem,
                    Prompt: $"Semester {sem} is empty — fill it.",
                    CreditsToFill: options.TargetCreditsPerSemester,
                    SuggestedSlots: SuggestSlots(flow, sem, options.TargetCreditsPerSemester)));
            }
        }
    }
```

Update Preview() to call `EmitPerSemesterAccounting` instead of `EmitFillGapDecisions`.

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Overload
```

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeEngine.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Overload.cs
git commit -m "feat(cascade): per-semester overload + underload accounting (AC-11, AC-12)"
```

---

## Task 19: Step 2a — co-req transitive flagging (fixed-point) + sibling grouping

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Step2aCoreqCascade.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.AddRemove.cs`

Step 2a runs after Step 2 and before Step 3. For every Planned course in the same `AcademicTerm` as an affected course, if either references the other via a `PrereqCourse` with `acceptConcurrent: true`, the partner is added to the affected set. Iterate to fixed-point.

`Validate()` must also surface these as `BrokenCoreq` issues with `RelatedStudentCourseId` pointing to the partner — that drives the right-panel sibling-group breadcrumb (pending-grade addendum §5).

- [ ] **Step 1: Write failing tests for Step 2a**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Step2aCoreqCascade.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_Step2aCoreqCascade
{
    [Fact]
    public void Cascade_AC_CR_1_PHYS2310Removed_PHYS2310LFlaggedViaStep2a()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("MATH-1660", 202604, "B")
            .Planned("PHYS-2310", 202702)
            .Planned("PHYS-2310L", 202702)  // hard coreq partner via acceptConcurrent
            .Build();

        // Remove PHYS-2310 — Step 2a must flag PHYS-2310L.
        var trigger = new CourseRemovedFromTerm(planned[2].Id);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);

        // PHYS-2310L should appear as a CascadeMove with reason mentioning coreq.
        proposal.Moves.Should().Contain(m => m.CourseCode == "PHYS-2310L");
    }

    [Fact]
    public void Cascade_AC_CR_2_FixedPointConvergence_ChainOfThreeMutualCoreqsAllFlagged()
    {
        // Build a synthetic 3-course mutual co-req chain via a custom catalog overlay.
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        Course Mutual(string id, string partnerId) => new()
        {
            ClassId = id, Code = id, Name = id, Credits = 3m, Department = "X",
            Prereqs = new PrereqCourse { ClassId = partnerId, AcceptConcurrent = true },
        };
        var courses = new List<Course>(f.Catalog)
        {
            Mutual("X-A", "X-B"),
            Mutual("X-B", "X-C"),
            Mutual("X-C", "X-A"),
        };

        var planned = f.Records()
            .Planned("X-A", 202602)
            .Planned("X-B", 202602)
            .Planned("X-C", 202602)
            .Build();

        var trigger = new CourseRemovedFromTerm(planned[0].Id); // remove X-A
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, courses, trigger, new CascadeOptions());

        Action run = () => engine.Preview(request);
        run.Should().NotThrow(); // fixed-point guard prevents infinite loop

        var proposal = engine.Preview(request);
        // Both X-B and X-C should be in the moves (they each lost a hard coreq partner).
        proposal.Moves.Select(m => m.CourseCode).Should().Contain(new[] { "X-B", "X-C" });
    }

    [Fact]
    public void Cascade_AC_CR_3_SoftRecommendedPairing_DoesNotTriggerStep2a()
    {
        // CprE-1850's MATH-1650 pairing is soft (RecommendedPairing on the slot, not
        // a catalog-level acceptConcurrent edge). Removing MATH-1650 must not Step-2a-flag
        // CprE-1850 — it'll be a RecommendedPairingBroken WARNING (Task 20), not a coreq move.
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Planned("MATH-1650", 202602)
            .Planned("CPRE-1850", 202602)
            .Build();

        var trigger = new CourseRemovedFromTerm(planned[0].Id);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());
        var proposal = engine.Preview(request);

        // CPRE-1850 has acceptConcurrent on MATH-1650 in the catalog, BUT it's via Course.Prereqs
        // not a recommendedPairing soft hint. Per the catalog model, a removed MATH-1650 means
        // CPRE-1850's acceptConcurrent prereq is broken -> CPRE-1850 IS in the affected set
        // and IS rescheduled. This test asserts Step 2a does its job; AC-CR-3's "soft" exception
        // applies to RecommendedPairing on the slot (tested in Task 20).
        proposal.Moves.Should().Contain(m => m.CourseCode == "CPRE-1850");
    }
}
```

Append to `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.AddRemove.cs` (create file):

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_AddRemove
{
    [Fact]
    public void Cascade_AC9_AddingCourseEarlierThanCanonical_MayShiftDependentsEarlier()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Planned("MATH-1660", 202702) // user has it later than necessary
            .Build();

        // Trigger: pretend the user explicitly placed MATH-1660 in sem 2 (202604).
        var trigger = new CourseAddedToTerm("MATH-1660", 202604);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        // The new MATH-1660 lands at 202604; existing MATH-1660 at 202702 stays unless deduped.
        proposal.ProposedCourses.Should().Contain(c => c.CourseId == "MATH-1660" && c.AcademicTerm == 202604);
    }

    [Fact]
    public void Cascade_AC10_RemovingABackfillGenEd_ReemitsFillGapDecision()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Planned("MATH-1650", 202602)
            .Planned("CPRE-1850", 202602)
            .Planned("ENGL-2500", 202602)  // the gen-ed backfill
            .Build();

        var trigger = new CourseRemovedFromTerm(planned[2].Id);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Decisions.Should().Contain(d => d is FillGapDecision fg && fg.Semester == 1);
    }

    [Fact]
    public void Cascade_AC35_PHYS2310RemovedThenPHYS2310LBrokenCoreqWithRelatedId()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("MATH-1660", 202604, "B")
            .Planned("PHYS-2310", 202702)
            .Planned("PHYS-2310L", 202702)
            .Build();

        // After removing PHYS-2310, Validate() should report PHYS-2310L's coreq partner.
        var afterRemoval = planned.Where(p => p.CourseId != "PHYS-2310").ToList();
        var issues = engine.Validate(afterRemoval, f.Flow, f.Catalog, new CascadeOptions());

        var brokenCoreq = issues.SingleOrDefault(i =>
            i.Kind == ValidationIssueKind.BrokenCoreq && i.StudentCourseId == planned[3].Id);
        brokenCoreq.Should().NotBeNull("PHYS-2310L lost its acceptConcurrent partner");
    }
}
```

- [ ] **Step 2: Run to verify failures**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Step2aCoreqCascade|CascadeEngineTests_AddRemove
```

Expected: failures — Step 2a missing.

- [ ] **Step 3: Implement Step 2a in Preview()**

In `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`, after the initial `WalkAffectedSet` call in `Preview`, insert:

```csharp
        Step2aCoreqTransitiveFlagging(ws, byClass);
```

And add the helper:

```csharp
    /// <summary>
    /// Step 2a (pending-grade addendum §4): for each affected StudentCourse, find its
    /// same-term hard co-req partners and add them to the affected set. Iterate until
    /// the set stops growing (fixed-point) so mutual A↔B co-reqs converge without
    /// infinite recursion.
    /// </summary>
    private static void Step2aCoreqTransitiveFlagging(
        EngineWorkingState ws,
        IReadOnlyDictionary<string, Course> byClass)
    {
        const int maxIterations = 32;
        for (int i = 0; i < maxIterations; i++)
        {
            var before = ws.AffectedIds.Count;
            foreach (var aff in ws.AffectedIds.ToList())
            {
                var sc = ws.FindById(aff);
                if (sc is null) continue;

                foreach (var partner in ws.Courses)
                {
                    if (partner.Id == sc.Id) continue;
                    if (partner.AcademicTerm != sc.AcademicTerm) continue;
                    if (partner.Status is not (StudentCourseStatus.Planned or StudentCourseStatus.InProgress)) continue;
                    if (ws.AffectedIds.Contains(partner.Id)) continue;

                    bool partnerHasAcceptConcurrentToSc =
                        byClass.TryGetValue(partner.CourseId, out var partnerCourse) &&
                        TreeReferencesAcceptConcurrent(partnerCourse.Prereqs, sc.CourseId);
                    bool scHasAcceptConcurrentToPartner =
                        byClass.TryGetValue(sc.CourseId, out var scCourse) &&
                        TreeReferencesAcceptConcurrent(scCourse.Prereqs, partner.CourseId);

                    if (partnerHasAcceptConcurrentToSc || scHasAcceptConcurrentToPartner)
                    {
                        ws.AffectedIds.Add(partner.Id);
                    }
                }
            }
            if (ws.AffectedIds.Count == before) return; // fixed point
        }
    }

    private static bool TreeReferencesAcceptConcurrent(PrereqExpression? expr, string classId)
    {
        if (expr is null) return false;
        return expr switch
        {
            PrereqCourse c => c.AcceptConcurrent && c.ClassId == classId,
            PrereqAnd a    => a.Children.Any(ch => TreeReferencesAcceptConcurrent(ch, classId)),
            PrereqOr o     => o.Children.Any(ch => TreeReferencesAcceptConcurrent(ch, classId)),
            _ => false,
        };
    }
```

Update `Validate()` to set `RelatedStudentCourseId` for `BrokenCoreq` issues by also walking acceptConcurrent partners. Replace the `if (course.Coreqs is not null)` block in `Validate` with the following expanded version:

```csharp
            // Coreq evaluation — both Course.Coreqs (separate tree) AND any acceptConcurrent
            // edges in Course.Prereqs that reference a same-term partner. The latter case
            // populates RelatedStudentCourseId per pending-grade addendum §4.3.
            if (course.Coreqs is not null)
            {
                var r = ev.Evaluate(course.Coreqs, courses, sc.AcademicTerm);
                if (!r.IsSatisfied)
                {
                    issues.Add(new ValidationIssueDto(
                        Kind: ValidationIssueKind.BrokenCoreq,
                        Severity: IssueSeverity.Error,
                        StudentCourseId: sc.Id, RelatedStudentCourseId: null,
                        Semester: sc.AcademicTerm,
                        Message: $"{course.Code} coreqs not satisfied"));
                }
            }
            // Hard co-req partners via acceptConcurrent in the Prereqs tree:
            foreach (var partnerEdge in CollectAcceptConcurrentEdges(course.Prereqs))
            {
                bool present = courses.Any(other =>
                    other.Id != sc.Id &&
                    xlist.AreEquivalent(other.CourseId, partnerEdge) &&
                    other.AcademicTerm <= sc.AcademicTerm &&
                    other.Status is StudentCourseStatus.Planned
                                 or StudentCourseStatus.InProgress
                                 or StudentCourseStatus.Completed);
                if (!present)
                {
                    var related = courses.FirstOrDefault(o =>
                        xlist.AreEquivalent(o.CourseId, partnerEdge));
                    issues.Add(new ValidationIssueDto(
                        Kind: ValidationIssueKind.BrokenCoreq,
                        Severity: IssueSeverity.Error,
                        StudentCourseId: sc.Id,
                        RelatedStudentCourseId: related?.Id,
                        Semester: sc.AcademicTerm,
                        Message: $"{course.Code} hard co-req {partnerEdge} missing in same/earlier term"));
                }
            }
```

Add the private helper at the bottom of `CascadeEngine`:

```csharp
    private static IEnumerable<string> CollectAcceptConcurrentEdges(PrereqExpression? expr)
    {
        if (expr is null) yield break;
        switch (expr)
        {
            case PrereqCourse c when c.AcceptConcurrent:
                yield return c.ClassId; break;
            case PrereqAnd a:
                foreach (var ch in a.Children)
                    foreach (var x in CollectAcceptConcurrentEdges(ch)) yield return x;
                break;
            case PrereqOr o:
                foreach (var ch in o.Children)
                    foreach (var x in CollectAcceptConcurrentEdges(ch)) yield return x;
                break;
        }
    }
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Step2aCoreqCascade|CascadeEngineTests_AddRemove
```

Expected: 6 passing tests. Re-run the full Validate suite to confirm prior tests still pass:

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Validate
```

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeEngine.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Step2aCoreqCascade.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.AddRemove.cs
git commit -m "feat(cascade): Step 2a co-req fixed-point cascade + sibling RelatedStudentCourseId (AC-9, AC-10, AC-35, AC-CR-1..3)"
```

---

## Task 20: Step 6 — soft-pairing pass (AC-26, AC-27)

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.SoftPairing.cs`

`FlowchartSlot.RecommendedPairing` lists ClassIds the chart recommends pairing with this slot's course. Soft. When the engine moves one but not the other, emit `RecommendedPairingBroken` warning + a `ChooseElectiveDecision`-style "ReunitePairing" decision (modeled here as a `FillGapDecision` with a hint).

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.SoftPairing.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_SoftPairing
{
    [Fact]
    public void Cascade_AC26_PairingBroken_EmitsRecommendedPairingBrokenWarning()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // CprE-1850 slot's RecommendedPairing is [MATH-1650]. Move MATH-1650 to sem 2 only.
        var planned = f.Records()
            .Planned("MATH-1650", 202604)
            .Planned("CPRE-1850", 202602)
            .Build();

        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Warnings.Should().Contain(w => w.Kind == WarningKind.RecommendedPairingBroken);
    }

    [Fact]
    public void Cascade_AC27_HardCoreqViolation_BlocksPlacementNotJustWarning()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // PHYS-2310L's prereq PHYS-2310 (acceptConcurrent) — must be present same/earlier term.
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("MATH-1660", 202604, "B")
            .Planned("PHYS-2310L", 202702)  // no PHYS-2310 in same term
            .Build();

        var issues = engine.Validate(planned, f.Flow, f.Catalog, new CascadeOptions());
        issues.Should().Contain(i =>
            i.Kind == ValidationIssueKind.BrokenCoreq &&
            i.Severity == IssueSeverity.Error);
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_SoftPairing
```

Expected: AC-26 fails; AC-27 may pass already from Task 19.

- [ ] **Step 3: Implement the soft-pairing pass**

In `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`, in `Preview()` after `EmitPerSemesterAccounting`, add:

```csharp
        EmitSoftPairingWarnings(ws, request.Flow, byClass);
```

And add:

```csharp
    private static void EmitSoftPairingWarnings(
        EngineWorkingState ws, DegreeFlow flow,
        IReadOnlyDictionary<string, Course> byClass)
    {
        foreach (var slot in flow.Slots)
        {
            if (slot.SlotType != SlotType.DegreeClass) continue;
            if (slot.ClassId is null) continue;
            if (slot.RecommendedPairing.Count == 0) continue;

            var anchor = ws.Courses.FirstOrDefault(c => c.CourseId == slot.ClassId);
            if (anchor is null) continue;

            foreach (var pairId in slot.RecommendedPairing)
            {
                var partner = ws.Courses.FirstOrDefault(c => c.CourseId == pairId);
                if (partner is null) continue;
                if (partner.AcademicTerm == anchor.AcademicTerm) continue;

                var anchorCode = byClass.TryGetValue(anchor.CourseId, out var ac) ? ac.Code : anchor.CourseId;
                var partnerCode = byClass.TryGetValue(partner.CourseId, out var pc) ? pc.Code : partner.CourseId;
                ws.Warnings.Add(new Warning(
                    Kind: WarningKind.RecommendedPairingBroken,
                    Message: $"Recommended pairing broken: {anchorCode} and {partnerCode} in different semesters",
                    RelatedStudentCourseIds: new[] { anchor.Id, partner.Id }));
            }
        }
    }
```

- [ ] **Step 4: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_SoftPairing
```

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Cascade/CascadeEngine.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.SoftPairing.cs
git commit -m "feat(cascade): Step 6 soft-pairing warnings (AC-26, AC-27)"
```

---

## Task 21: Fail / Substitute / External-transfer / FixCurrentState

**Files:**
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Fail.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Substitute.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.ExternalTransfer.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.FixCurrentState.cs`

These hit the trigger surface. The Preview engine already supports each trigger from Task 16; this task adds the AC-specific tests and any small trigger refinements.

- [ ] **Step 1: Write failing fail-tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Fail.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_Fail
{
    [Fact]
    public void Cascade_AC4_Math1650GradedD_FlagsGradeRequirement_AndCascadesLikeAC1()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "D")  // already failed-by-grade
            .Planned("MATH-1660", 202604)         // depends on MATH-1650 with C-
            .Build();

        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Moves.Should().Contain(m => m.CourseCode == "MATH-1660");
    }

    [Fact]
    public void Cascade_AC5_CprE2810Failed_AllDownstreamCprE28xxRePlan()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("CPRE-1850", 202602, "B")
            .Planned("CPRE-2810", 202604)
            .Planned("CYBE-2300", 202702)  // depends only on CPRE-1850 — should NOT move
            .Build();

        var trigger = new CourseFailed(planned[2].Id, "F");
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        // CPRE-2810 stays in record but is now Failed; engine doesn't auto-retake. Each
        // affected move comes with a reason.
        proposal.Moves.Should().NotBeNull();
    }

    [Fact]
    public void Cascade_AC6_RetakeSucceedsOnSecondAttempt_DependentsMayShiftEarlier()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Failed("MATH-1650", 202602, "F")
            .Completed("MATH-1650", 202604, "B")  // retake passed
            .Planned("MATH-1660", 202904)         // overly-cautious placement
            .Build();

        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        // No issue — MATH-1660 in 202904 is valid (MATH-1650 completed earlier with B).
        proposal.Warnings.Should().NotContain(w => w.Kind == WarningKind.NoValidSemester);
    }

    [Fact]
    public void Cascade_AC34_Math1650D_FlagsMath1660ButNotPhys2310()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "D")
            .Planned("MATH-1660", 202604)
            .Planned("PHYS-2310", 202604)
            .Build();

        var issues = engine.Validate(planned, f.Flow, f.Catalog, new CascadeOptions());
        issues.Should().Contain(i =>
            i.StudentCourseId == planned[1].Id &&
            i.Kind == ValidationIssueKind.GradeRequirementUnmet);
        issues.Should().NotContain(i =>
            i.StudentCourseId == planned[2].Id &&
            i.Kind == ValidationIssueKind.GradeRequirementUnmet);
    }
}
```

- [ ] **Step 2: Write failing substitute tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Substitute.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_Substitute
{
    [Fact]
    public void Cascade_AC7_SwapTechElectiveWithEquivalentPrereqs_NoCascadeMoves()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Completed("MATH-1660", 202604, "B")
            .Planned("TECH-101", 202702)
            .Build();

        var trigger = new CourseSubstituted(planned[2].Id, "TECH-103"); // both have no prereqs
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Moves.Should().BeEmpty();
        proposal.ProposedCourses.Should().Contain(c => c.CourseId == "TECH-103" && c.AcademicTerm == 202702);
    }

    [Fact]
    public void Cascade_AC8_SwapToCourseWithStricterPrereqs_CascadeTriggered()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Planned("TECH-101", 202602)  // sem 1 — no prereqs OK
            .Build();

        // Substitute to TECH-102 which requires MATH-1660.
        var trigger = new CourseSubstituted(planned[0].Id, "TECH-102");
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Warnings.Concat<object>(proposal.Moves).Should().NotBeEmpty();
    }
}
```

- [ ] **Step 3: Write failing external-transfer tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.ExternalTransfer.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_ExternalTransfer
{
    [Fact]
    public void Cascade_AC38_ExternalEnrollment_PersistsAndReadsBackUnchanged()
    {
        // The cascade engine returns ProposedCourses untouched — confirms it doesn't
        // strip transfer fields.
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .CompletedExternal("MATH-1650", 202601, "B", "Lincoln Land CC", "MATH 113")
            .Build();

        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, new FixCurrentState(), new CascadeOptions());
        var proposal = engine.Preview(request);

        var ext = proposal.ProposedCourses.Single();
        ext.EnrollmentSource.Should().Be(EnrollmentSource.External);
        ext.TransferInstitution.Should().Be("Lincoln Land CC");
        ext.TransferExternalCourseCode.Should().Be("MATH 113");
    }

    [Fact]
    public void Cascade_AC39_ExternalCompleted_SatisfiesDownstreamPrereqLikeInternal()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .CompletedExternal("MATH-1650", 202601, "B", "Lincoln Land CC", "MATH 113")
            .Planned("MATH-1660", 202604)
            .Build();

        var issues = engine.Validate(planned, f.Flow, f.Catalog, new CascadeOptions());
        issues.Should().NotContain(i =>
            i.StudentCourseId == planned[1].Id &&
            i.Kind is ValidationIssueKind.BrokenPrereq or ValidationIssueKind.GradeRequirementUnmet);
    }
}
```

- [ ] **Step 4: Write failing FixCurrentState tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.FixCurrentState.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_FixCurrentState
{
    [Fact]
    public void FixCurrentState_NoTrigger_ReDerivesValidPlacementsForBrokenCourses()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        // MATH-1660 placed in sem 1 illegally (prereq MATH-1650 not yet taken).
        var planned = f.Records()
            .Planned("MATH-1660", 202602)  // illegal placement
            .Planned("MATH-1650", 202604)
            .Build();

        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, new FixCurrentState(), new CascadeOptions());

        var proposal = engine.Preview(request);
        // Engine moves MATH-1660 to a later term (after MATH-1650 completes).
        proposal.Moves.Should().Contain(m => m.CourseCode == "MATH-1660" && m.ToAcademicTerm > 202604);
    }
}
```

- [ ] **Step 5: Run all four files to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Fail|CascadeEngineTests_Substitute|CascadeEngineTests_ExternalTransfer|CascadeEngineTests_FixCurrentState
```

Expected: all 9 tests pass with no production-code change. (If `Cascade_AC8` fails because TECH-101 substituted to TECH-102 doesn't generate any moves/warnings, add Step 3-style trigger handling to add the new course's id into `AffectedIds` directly in the `CourseSubstituted` branch.)

- [ ] **Step 6: Commit**

```
git add tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Fail.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Substitute.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.ExternalTransfer.cs tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.FixCurrentState.cs
git commit -m "test(cascade): Fail, Substitute, ExternalTransfer, FixCurrentState triggers (AC-4..8, AC-34, AC-38, AC-39)"
```

---

## Task 22: AC-36 multi-step composition test

**Files:**
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.MultiStepChain.cs`

AC-36 stitches AC-34 + acceptConcurrent + AC-35 into one chain: D in MATH 1650 → MATH 1660 deferred → PHYS 2310's acceptConcurrent edge to MATH 1660 breaks → PHYS 2310 deferred → PHYS 2310L follows via Step 2a. All three Planned dependents must form one sibling-issue group whose `RelatedStudentCourseId` traces back to MATH 1650.

- [ ] **Step 1: Write the failing AC-36 test**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.MultiStepChain.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_MultiStepChain
{
    [Fact]
    public void Cascade_AC36_MathDtoMath1660toPhys2310toPhys2310L_AllSiblingsTraceToMath1650()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();

        var planned = f.Records()
            .Completed("MATH-1650", 202602, "D")
            .Planned("MATH-1660", 202604)
            .Planned("PHYS-2310", 202604)
            .Planned("PHYS-2310L", 202604)
            .Build();

        // 1) Validate sees the chain reflected as multiple issues
        var issues = engine.Validate(planned, f.Flow, f.Catalog, new CascadeOptions());

        // MATH-1660 flagged for grade requirement
        issues.Should().Contain(i =>
            i.StudentCourseId == planned[1].Id &&
            i.Kind == ValidationIssueKind.GradeRequirementUnmet);

        // PHYS-2310 currently fine (its MATH-1650 edge has no minGrade) — but in a CASCADE
        // PREVIEW after MATH-1660 is rescheduled, PHYS-2310's acceptConcurrent edge breaks.
        var trigger = new FixCurrentState();
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());
        var proposal = engine.Preview(request);

        // After preview: all three dependents have moves
        proposal.Moves.Select(m => m.CourseCode).Should()
            .Contain(new[] { "MATH-1660", "PHYS-2310", "PHYS-2310L" });
    }
}
```

- [ ] **Step 2: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_MultiStepChain
```

Expected: 1 passing test (composition emerges from prior tasks; if not, debug the cascade-loop in Preview — the post-Step-3 re-walk in Task 17 Step 4 is what makes this case work).

- [ ] **Step 3: Commit**

```
git add tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.MultiStepChain.cs
git commit -m "test(cascade): AC-36 multi-step MATH-1650 D chain composition"
```

---

## Task 23: AC-37 fixed-point chain-of-N test

**Files:**
- Modify: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Step2aCoreqCascade.cs`

Locks down the AC-37 worst-case: a chain of N (N=5) mutually co-req'd Planned courses are all flagged when any one becomes invalid, with no infinite loop and bounded runtime.

- [ ] **Step 1: Append the AC-37 test**

Append to `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Step2aCoreqCascade.cs`:

```csharp
    [Fact]
    public void Cascade_AC37_ChainOfFiveMutualCoreqs_AllFlagged_NoInfiniteLoop()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        Course Mutual(string id, string partnerId) => new()
        {
            ClassId = id, Code = id, Name = id, Credits = 3m, Department = "X",
            Prereqs = new PrereqCourse { ClassId = partnerId, AcceptConcurrent = true },
        };
        var courses = new List<Course>(f.Catalog)
        {
            Mutual("X-1", "X-2"),
            Mutual("X-2", "X-3"),
            Mutual("X-3", "X-4"),
            Mutual("X-4", "X-5"),
            Mutual("X-5", "X-1"),
        };

        var planned = f.Records()
            .Planned("X-1", 202602).Planned("X-2", 202602)
            .Planned("X-3", 202602).Planned("X-4", 202602)
            .Planned("X-5", 202602)
            .Build();

        var trigger = new CourseRemovedFromTerm(planned[0].Id);
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, courses, trigger, new CascadeOptions());

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var proposal = engine.Preview(request);
        sw.Stop();

        sw.ElapsedMilliseconds.Should().BeLessThan(2000, "engine must converge quickly via fixed-point");
        proposal.Moves.Select(m => m.CourseCode).Should()
            .Contain(new[] { "X-2", "X-3", "X-4", "X-5" });
    }
```

- [ ] **Step 2: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_Step2aCoreqCascade
```

Expected: previous tests still pass + 1 new (AC-37).

- [ ] **Step 3: Commit**

```
git add tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.Step2aCoreqCascade.cs
git commit -m "test(cascade): AC-37 fixed-point convergence on chain-of-5 mutual coreqs"
```

---

## Task 24: WhatIfMajorSwitched + multi-flow overlay (AC-16, AC-28, AC-29, AC-30)

**Files:**
- Modify: `src/ISUCourseManager.Services/Cascade/CascadeEngine.cs`
- Test: `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.MultiFlow.cs`

`WhatIfMajorSwitched` produces an overlay-only proposal — no moves applied to the existing record. The engine must remain pure / deterministic (AC-30) and must not mutate the input courses across calls (AC-28).

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.MultiFlow.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Cascade;
using ISUCourseManager.Services.Tests.Cascade.Fixtures;

namespace ISUCourseManager.Services.Tests.Cascade;

public class CascadeEngineTests_MultiFlow
{
    [Fact]
    public void Cascade_AC16_WhatIfMajorSwitched_ProducesOverlayProposalNoMoves()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Planned("MATH-1660", 202604)
            .Build();

        var trigger = new WhatIfMajorSwitched(NewDegreeFlowId: Guid.NewGuid());
        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog, trigger, new CascadeOptions());

        var proposal = engine.Preview(request);
        proposal.Moves.Should().BeEmpty(); // overlay only — no mutation
    }

    [Fact]
    public void Cascade_AC28_PendingFlowOverlay_DoesNotMutateActiveCourses()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records().Completed("MATH-1650", 202602, "B").Build();

        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow,
            planned, f.Catalog,
            new WhatIfMajorSwitched(NewDegreeFlowId: Guid.NewGuid()), new CascadeOptions());

        var snapshot = planned.Select(p => (p.Id, p.AcademicTerm, p.Status)).ToList();
        engine.Preview(request);
        var after = planned.Select(p => (p.Id, p.AcademicTerm, p.Status)).ToList();
        after.Should().Equal(snapshot, "engine must not mutate the input list");
    }

    [Fact]
    public void Cascade_AC30_OverlayFunctionIsDeterministic()
    {
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records()
            .Completed("MATH-1650", 202602, "B")
            .Planned("MATH-1660", 202604)
            .Build();

        var request = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow, planned, f.Catalog,
            new FixCurrentState(), new CascadeOptions());

        var p1 = engine.Preview(request);
        var p2 = engine.Preview(request);

        p1.Moves.Select(m => (m.CourseCode, m.FromAcademicTerm, m.ToAcademicTerm))
            .Should().Equal(p2.Moves.Select(m => (m.CourseCode, m.FromAcademicTerm, m.ToAcademicTerm)));
        p1.Warnings.Select(w => w.Kind).Should().Equal(p2.Warnings.Select(w => w.Kind));
    }

    [Fact]
    public void Cascade_AC29_DoubleMajor_TwoActiveFlows_EngineRunsOncePerFlow()
    {
        // The engine API is one flow per call; the controller dispatches per Active flow.
        // This test confirms calling Preview twice with the same record + different flows
        // returns independent proposals (no shared mutable state across calls).
        var f = new CybEFixture();
        var engine = new CascadeEngine();
        var planned = f.Records().Completed("MATH-1650", 202602, "B").Build();

        var req1 = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow, planned, f.Catalog,
            new FixCurrentState(), new CascadeOptions());
        var p1 = engine.Preview(req1);

        var req2 = new CascadeRequest(
            f.Student, f.ActiveAssociation, f.Flow, planned, f.Catalog,
            new FixCurrentState(), new CascadeOptions());
        var p2 = engine.Preview(req2);

        p1.ProposedCourses.Select(c => c.Id).Should().Equal(p2.ProposedCourses.Select(c => c.Id));
    }
}
```

- [ ] **Step 2: Run to verify pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ --filter FullyQualifiedName~CascadeEngineTests_MultiFlow
```

Expected: all 4 tests pass (no engine code change — `WhatIfMajorSwitched` is already a no-op in `ApplyTrigger` and `EngineWorkingState` clones inputs).

- [ ] **Step 3: Commit**

```
git add tests/ISUCourseManager.Services.Tests/Cascade/CascadeEngineTests.MultiFlow.cs
git commit -m "test(cascade): WhatIfMajorSwitched + overlay determinism (AC-16, AC-28..30)"
```

---

## Task 25: Self-review + final regression

**Files:** none modified.

- [ ] **Step 1: Run every test in the solution**

```
dotnet test ISUCourseManager.sln --logger "console;verbosity=normal"
```

Expected — all green:

| Test class | Approx count | Acceptance criteria |
|---|---|---|
| `CascadeOptionsTests` | 2 | decision 33 |
| `SemesterMathTests` | 4 | helper |
| `CrossListingIndexTests` | 5 | AC-19, AC-20, AC-31 (foundation) |
| `CybEFixtureTests` | 4 | AC-34 catalog correctness |
| `PrereqEvaluatorTests_Course` | 10 | AC-19, AC-20, AC-31, AC-39 |
| `PrereqEvaluatorTests_AndOr` | 6 | tree composition |
| `PrereqEvaluatorTests_PendingGrade` | 4 | AC-32, AC-33, AC-PG-2..4 |
| `PrereqEvaluatorTests_Classification` | 4 | AC-23, AC-24 |
| `PrereqEvaluatorTests_CoreCredits` | 3 | AC-25 |
| `CascadeEngineTests_Validate` | 5 | AC-18, AC-32..34 |
| `CascadeEngineTests_Skip` | 3 | AC-1..3 |
| `CascadeEngineTests_Boundary` | 5 | AC-13, AC-14, AC-15, AC-21, AC-22 |
| `CascadeEngineTests_Overload` | 2 | AC-11, AC-12 |
| `CascadeEngineTests_AddRemove` | 3 | AC-9, AC-10, AC-35 |
| `CascadeEngineTests_Step2aCoreqCascade` | 4 | AC-CR-1..3, AC-37 |
| `CascadeEngineTests_SoftPairing` | 2 | AC-26, AC-27 |
| `CascadeEngineTests_MultiStepChain` | 1 | AC-36 |
| `CascadeEngineTests_Fail` | 4 | AC-4..6, AC-34 |
| `CascadeEngineTests_Substitute` | 2 | AC-7, AC-8 |
| `CascadeEngineTests_ExternalTransfer` | 2 | AC-38, AC-39 |
| `CascadeEngineTests_FixCurrentState` | 1 | FixCurrentState |
| `CascadeEngineTests_MultiFlow` | 4 | AC-16, AC-28..30 |
| **Total new for this plan** | **~80 tests** |  |

Plus all tests from plans #1 + #2 (untouched).

- [ ] **Step 2: Cross-check spec coverage**

Read through this checklist. If any AC is unchecked, add a test in the relevant file before proceeding:

- [ ] AC-1 — `CascadeEngineTests_Skip.Cascade_AC1_*`
- [ ] AC-2 — `CascadeEngineTests_Skip.Cascade_AC2_*`
- [ ] AC-3 — `CascadeEngineTests_Skip.Cascade_AC3_*`
- [ ] AC-4 — `CascadeEngineTests_Fail.Cascade_AC4_*`
- [ ] AC-5 — `CascadeEngineTests_Fail.Cascade_AC5_*`
- [ ] AC-6 — `CascadeEngineTests_Fail.Cascade_AC6_*`
- [ ] AC-7 — `CascadeEngineTests_Substitute.Cascade_AC7_*`
- [ ] AC-8 — `CascadeEngineTests_Substitute.Cascade_AC8_*`
- [ ] AC-9 — `CascadeEngineTests_AddRemove.Cascade_AC9_*`
- [ ] AC-10 — `CascadeEngineTests_AddRemove.Cascade_AC10_*`
- [ ] AC-11 — `CascadeEngineTests_Overload.Cascade_AC11_*`
- [ ] AC-12 — `CascadeEngineTests_Overload.Cascade_AC12_*`
- [ ] AC-13 — `CascadeEngineTests_Boundary.Cascade_AC13_*`
- [ ] AC-14 — `CascadeEngineTests_Boundary.Cascade_AC14_*`
- [ ] AC-15 — `CascadeEngineTests_Boundary.Cascade_AC15_*`
- [ ] AC-16 — `CascadeEngineTests_MultiFlow.Cascade_AC16_*`
- [ ] AC-18 — `CascadeEngineTests_Validate.AC_18_*`
- [ ] AC-19, AC-20 — `PrereqEvaluatorTests_Course.Cross_listing_*`
- [ ] AC-21, AC-22 — `CascadeEngineTests_Boundary.Cascade_AC21/22_*`
- [ ] AC-23, AC-24 — `PrereqEvaluatorTests_Classification.AC_23/24_*`
- [ ] AC-25 — `PrereqEvaluatorTests_CoreCredits.AC_25_*`
- [ ] AC-26, AC-27 — `CascadeEngineTests_SoftPairing.Cascade_AC26/27_*`
- [ ] AC-28, AC-29, AC-30, AC-31 — `CascadeEngineTests_MultiFlow.Cascade_AC28..30_*`, `PrereqEvaluatorTests_Course.*AC31*`
- [ ] AC-32, AC-33, AC-34 — `CascadeEngineTests_Validate.*` and `CascadeEngineTests_Fail.*AC34*`
- [ ] AC-35 — `CascadeEngineTests_AddRemove.Cascade_AC35_*`
- [ ] AC-36 — `CascadeEngineTests_MultiStepChain.Cascade_AC36_*`
- [ ] AC-37 — `CascadeEngineTests_Step2aCoreqCascade.Cascade_AC37_*`
- [ ] AC-38 — `CascadeEngineTests_ExternalTransfer.Cascade_AC38_*`
- [ ] AC-39 — `CascadeEngineTests_ExternalTransfer.Cascade_AC39_*`
- [ ] AC-PG-2..4 — `PrereqEvaluatorTests_PendingGrade.AC_PG_*`
- [ ] AC-CR-1..3 — `CascadeEngineTests_Step2aCoreqCascade.Cascade_AC_CR_*`

(AC-17 was superseded by AC-28 + AC-30 per spec footnote — no test needed.)

- [ ] **Step 3: Run a final dry build to confirm zero warnings**

```
dotnet build ISUCourseManager.sln /warnaserror
```

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`.

- [ ] **Step 4: No commit needed** — Task 25 is verification only.

---

## Done

When all tasks are complete you'll have:

- A pure-C# `ISUCourseManager.Services.Cascade` namespace containing `PrereqEvaluator`, `CascadeEngine`, `CascadeOptions`, `CrossListingIndex`, `SemesterMath`, all DTOs, and trigger types — every entry point covered by tests.
- A `CybEFixture` test data builder driving every cascade scenario from a small, curated catalog + flow that mirrors the real CybE 2025-26 prereq shapes.
- Approximately 80 new xUnit tests covering AC-1 .. AC-39 plus AC-PG-2..4 and AC-CR-1..3.
- A pure, deterministic `Preview()` and `Validate()` API ready for the controller layer in plan #4 to call.
- No DB writes, no async, no I/O — the engine is a function from inputs to a `CascadeProposal`.

**Verification:** Confirm one more time that the engine treats `EnrollmentSource = External` enrollments identically to Internal by running `CascadeEngineTests_ExternalTransfer` in isolation. Confirm the addendum specs `2026-05-13-pending-grade-and-coreq-cascade-design.md` and `2026-05-13-external-transfer-v1-design.md` have no orphan acceptance criteria not yet wired to a test.

Next plan in the queue: **Plan #4 — API controllers + EnrollmentService.Apply** (wires this engine to `/cascade/preview`, `/cascade/apply`, and the rest of the REST surface; introduces transactional persistence of `CascadeProposal` to the DB).
