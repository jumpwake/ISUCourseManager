# Seed Data Validation + JSON Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a .NET 8 solution with three projects (`ISUCourseManager.Api`, `ISUCourseManager.Services`, `ISUCourseManager.Data`) and write a JSON seed loader plus integrity tests that validate `Data/cybe_flowchart.json` and `Documentation/seed-templates/isu-catalog.json` against the spec's domain model.

**Architecture:** Pure C# POCOs with no EF Core or DB yet — that comes in a later plan. JSON deserialization via `System.Text.Json` with a custom polymorphic `JsonConverter` for the `PrereqExpression` tree. `SeedLoader` produces in-memory `Catalog` + `DegreeFlow` objects. `SeedValidator` runs structural and referential integrity checks against them. Tests exercise everything with the actual seed files in the repo.

**Tech Stack:** .NET 8 LTS, xUnit, FluentAssertions, System.Text.Json. Cross-platform — runs on Windows, macOS, Linux.

**Spec reference:** `docs/superpowers/specs/2026-05-12-isu-course-manager-design.md` §3 (architecture), §4 (domain model), §11 (open items: this plan addresses the seed-file ingestion piece).

**Out of scope (later plans):** EF Core + SQLite persistence, repositories, ApplicationDbContext, migrations. Cascade engine, validation, wizard. ASP.NET Core API. React frontend. Auth.

---

## File structure

What this plan creates:

```
ISUCourseManager.sln                               (new)

src/
├── ISUCourseManager.Api/                          (created but empty placeholder; later plan fills it)
│   └── ISUCourseManager.Api.csproj
├── ISUCourseManager.Services/
│   ├── ISUCourseManager.Services.csproj
│   └── Validation/
│       ├── SeedValidator.cs                       runs all integrity checks; returns a report
│       ├── ValidationReport.cs                    aggregate result with errors[] + warnings[]
│       └── ValidationIssue.cs                     one issue (kind, severity, message, location)
└── ISUCourseManager.Data/
    ├── ISUCourseManager.Data.csproj
    ├── Entity/
    │   ├── Course.cs
    │   ├── DegreeFlow.cs
    │   ├── FlowchartSlot.cs
    │   ├── StudentCourse.cs                  (replaces PlanItem; no PlanId)
    │   ├── StudentDegreeFlow.cs              (junction with Status — replaces Plan.SelectedDegreeFlowId)
    │   ├── Student.cs
    │   ├── PrereqExpression.cs                    abstract base
    │   ├── PrereqAnd.cs
    │   ├── PrereqOr.cs
    │   ├── PrereqCourse.cs
    │   ├── PrereqClassification.cs
    │   ├── PrereqCoreCredits.cs
    │   └── Enums.cs                               SlotType, Term, Season, StudentCourseStatus,
    │                                              StudentDegreeFlowStatus, Classification
    └── Seed/
        ├── SeedLoader.cs                          public entry point: loads catalog + flow files
        ├── PrereqExpressionConverter.cs           System.Text.Json polymorphic converter
        └── Json/
            ├── CatalogJson.cs                     internal DTO mirroring isu-catalog.json
            └── FlowJson.cs                        internal DTO mirroring flow JSON files

tests/
└── ISUCourseManager.Services.Tests/
    ├── ISUCourseManager.Services.Tests.csproj
    ├── Helpers/
    │   └── RepoPaths.cs                           resolves solution-root paths from test bin dir
    ├── PrereqExpressionConverterTests.cs          round-trip serialization for each node type
    ├── SeedLoaderTests.cs                         small synthetic JSON fixtures
    ├── SeedValidatorTests.cs                      each integrity check, synthetic positive + negative cases
    └── ActualSeedFileTests.cs                     end-to-end: load real files, run all validations
```

Dependency direction (see spec §3): `Api → Services → Data`. The test project references `Services` (transitively gets `Data`).

The actual seed files stay where they are now (`Data/cybe_flowchart.json` and `Documentation/seed-templates/isu-catalog.json`). The tests resolve these paths at runtime via a small helper. A later plan will move them into `src/ISUCourseManager.Data/Seed/` as the canonical location.

---

## Task 1: Bootstrap solution and projects

**Files:**
- Create: `ISUCourseManager.sln`
- Create: `src/ISUCourseManager.Api/ISUCourseManager.Api.csproj`
- Create: `src/ISUCourseManager.Services/ISUCourseManager.Services.csproj`
- Create: `src/ISUCourseManager.Data/ISUCourseManager.Data.csproj`
- Create: `tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj`

- [ ] **Step 1: Verify .NET 8 SDK is installed**

Run: `dotnet --version`
Expected: any 8.x.x output (e.g., `8.0.404`). If lower, install .NET 8 SDK from https://dotnet.microsoft.com/download.

- [ ] **Step 1b: Extend `.gitignore` for .NET build artifacts**

The repo's existing `.gitignore` covers `node_modules/`, `dist/`, etc., but not the `bin/`, `obj/`, IDE files that .NET builds produce. Without this, the first `dotnet build` plus the first `git add src/` will sweep megabytes of artifacts into the commit.

Append to `.gitignore`:
```
# .NET build artifacts
bin/
obj/
*.user
*.suo
.vs/
[Dd]ebug/
[Rr]elease/
TestResults/
*.dll
*.pdb
artifacts/
```

Then verify the existing `.gitignore` content is preserved by running:
```
cat .gitignore
```
Expected: shows the original entries (`.superpowers/`, `node_modules/`, etc.) plus the new .NET block.

- [ ] **Step 2: Create the solution file**

From the repository root:
```
dotnet new sln --name ISUCourseManager
```
Expected: `The template "Solution File" was created successfully.`

- [ ] **Step 3: Create the three source projects**

```
dotnet new classlib --framework net8.0 --output src/ISUCourseManager.Data --name ISUCourseManager.Data
dotnet new classlib --framework net8.0 --output src/ISUCourseManager.Services --name ISUCourseManager.Services
dotnet new web --framework net8.0 --output src/ISUCourseManager.Api --name ISUCourseManager.Api
```

Each command should print `The template "..." was created successfully.`

Delete the auto-generated placeholder file in each library (we'll add real entities in later tasks):
```
rm src/ISUCourseManager.Data/Class1.cs
rm src/ISUCourseManager.Services/Class1.cs
```

(Windows users use `del` instead of `rm`.)

- [ ] **Step 4: Create the test project**

```
dotnet new xunit --framework net8.0 --output tests/ISUCourseManager.Services.Tests --name ISUCourseManager.Services.Tests
rm tests/ISUCourseManager.Services.Tests/UnitTest1.cs
```

- [ ] **Step 5: Wire project references**

```
dotnet add src/ISUCourseManager.Services/ISUCourseManager.Services.csproj reference src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
dotnet add src/ISUCourseManager.Api/ISUCourseManager.Api.csproj reference src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
dotnet add tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj reference src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

Each should print `Reference ... added to the project.`

- [ ] **Step 6: Add all projects to the solution**

```
dotnet sln ISUCourseManager.sln add src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
dotnet sln ISUCourseManager.sln add src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
dotnet sln ISUCourseManager.sln add src/ISUCourseManager.Api/ISUCourseManager.Api.csproj
dotnet sln ISUCourseManager.sln add tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj
```

- [ ] **Step 7: Add FluentAssertions to the test project**

```
dotnet add tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj package FluentAssertions
```

- [ ] **Step 8: Enable nullable reference types and implicit usings in all source projects**

Edit `src/ISUCourseManager.Data/ISUCourseManager.Data.csproj` so its `<PropertyGroup>` reads:
```xml
<PropertyGroup>
  <TargetFramework>net8.0</TargetFramework>
  <ImplicitUsings>enable</ImplicitUsings>
  <Nullable>enable</Nullable>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
</PropertyGroup>
```

Apply the same `<PropertyGroup>` block to `ISUCourseManager.Services.csproj` and `ISUCourseManager.Api.csproj`. For the test project, omit `TreatWarningsAsErrors` (test projects often have benign warnings).

- [ ] **Step 9: Build the entire solution**

```
dotnet build ISUCourseManager.sln
```

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

- [ ] **Step 10: Run the empty test suite**

```
dotnet test ISUCourseManager.sln
```

Expected: `Passed! - Failed: 0, Passed: 0, Skipped: 0`

- [ ] **Step 11: Commit**

```
git add ISUCourseManager.sln src/ tests/
git commit -m "feat: bootstrap .NET 8 solution with Api/Services/Data projects"
```

---

## Task 2: Define enums

**Files:**
- Create: `src/ISUCourseManager.Data/Entity/Enums.cs`

Enums are just lookups; no test needed beyond the `dotnet build` they enable.

- [ ] **Step 1: Create Enums.cs**

Create `src/ISUCourseManager.Data/Entity/Enums.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

/// <summary>
/// What this flowchart slot represents. DegreeClass = a specific required course
/// (paired with ClassId). The Elective* values are placeholder slots the user fills
/// with their own choice from the catalog filtered to that category.
/// </summary>
public enum SlotType
{
    DegreeClass,        // specific required course (ClassId is populated)
    ElectiveGenEd,      // any approved general-education elective
    ElectiveMath,       // any approved math elective
    ElectiveTech,       // any approved technical elective (open list)
    ElectiveCybE,       // any approved Cyber Security Engineering elective
    ElectiveCprE,       // any approved Computer Engineering elective
}

public enum Term
{
    Fall,
    Spring,
    Summer,
}

public enum Season
{
    Summer = 1,
    Fall   = 2,
    Winter = 3,
    Spring = 4,
}

public enum StudentCourseStatus
{
    Planned,
    InProgress,
    Completed,
    Failed,
    Withdrawn,
}

public enum StudentDegreeFlowStatus
{
    Pending,
    Active,
    Deleted,
    Completed,
}

public enum Classification
{
    Freshman,
    Sophomore,
    Junior,
    Senior,
}
```

- [ ] **Step 2: Build to verify**

```
dotnet build src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
```

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Data/Entity/Enums.cs
git commit -m "feat(domain): add SlotType, Term, Season, StudentCourseStatus, StudentDegreeFlowStatus, Classification enums"
```

---

## Task 3: PrereqExpression hierarchy with TDD round-trip serialization

**Files:**
- Create: `src/ISUCourseManager.Data/Entity/PrereqExpression.cs`
- Create: `src/ISUCourseManager.Data/Entity/PrereqAnd.cs`
- Create: `src/ISUCourseManager.Data/Entity/PrereqOr.cs`
- Create: `src/ISUCourseManager.Data/Entity/PrereqCourse.cs`
- Create: `src/ISUCourseManager.Data/Entity/PrereqClassification.cs`
- Create: `src/ISUCourseManager.Data/Entity/PrereqCoreCredits.cs`
- Create: `src/ISUCourseManager.Data/Seed/PrereqExpressionConverter.cs`
- Test: `tests/ISUCourseManager.Services.Tests/PrereqExpressionConverterTests.cs`

The wire format uses a `type` discriminator: `{"type": "Course", "classId": "MATH-1650"}` → `PrereqCourse`. We write a custom `JsonConverter<PrereqExpression>` to handle the polymorphism (System.Text.Json's built-in polymorphic support requires attributes that don't compose with the `type` field as a string discriminator).

- [ ] **Step 1: Write failing round-trip tests**

Create `tests/ISUCourseManager.Services.Tests/PrereqExpressionConverterTests.cs`:

```csharp
using System.Text.Json;
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Seed;

namespace ISUCourseManager.Services.Tests;

public class PrereqExpressionConverterTests
{
    private readonly JsonSerializerOptions _opts = new()
    {
        Converters = { new PrereqExpressionConverter() },
    };

    [Fact]
    public void Course_node_round_trips()
    {
        var json = """{"type":"Course","classId":"MATH-1650"}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        node.Should().BeOfType<PrereqCourse>()
            .Which.ClassId.Should().Be("MATH-1650");
        var back = JsonSerializer.Serialize(node, _opts);
        JsonDocument.Parse(back).RootElement.GetProperty("classId").GetString().Should().Be("MATH-1650");
    }

    [Fact]
    public void Course_node_with_minGrade_and_acceptConcurrent_round_trips()
    {
        var json = """{"type":"Course","classId":"MATH-1650","minGrade":"C-","acceptConcurrent":true}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        var c = node.Should().BeOfType<PrereqCourse>().Subject;
        c.ClassId.Should().Be("MATH-1650");
        c.MinGrade.Should().Be("C-");
        c.AcceptConcurrent.Should().BeTrue();
    }

    [Fact]
    public void Or_node_with_three_courses_round_trips()
    {
        var json = """
        {"type":"Or","children":[
          {"type":"Course","classId":"CPRE-3080"},
          {"type":"Course","classId":"COMS-2520"},
          {"type":"Course","classId":"COMS-3520"}
        ]}
        """;
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        var or = node.Should().BeOfType<PrereqOr>().Subject;
        or.Children.Should().HaveCount(3);
        or.Children.Select(c => ((PrereqCourse)c).ClassId).Should().Equal("CPRE-3080", "COMS-2520", "COMS-3520");
    }

    [Fact]
    public void And_with_nested_Or_round_trips()
    {
        var json = """
        {"type":"And","children":[
          {"type":"Course","classId":"MATH-1660"},
          {"type":"Or","children":[
            {"type":"Course","classId":"MATH-2010"},
            {"type":"Course","classId":"COMS-2300"}
          ]}
        ]}
        """;
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        var and = node.Should().BeOfType<PrereqAnd>().Subject;
        and.Children.Should().HaveCount(2);
        and.Children[1].Should().BeOfType<PrereqOr>();
    }

    [Fact]
    public void Classification_node_round_trips()
    {
        var json = """{"type":"Classification","min":"Sophomore"}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        node.Should().BeOfType<PrereqClassification>()
            .Which.Min.Should().Be(Classification.Sophomore);
    }

    [Fact]
    public void CoreCredits_node_round_trips()
    {
        var json = """{"type":"CoreCredits","minCoreCredits":29}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        node.Should().BeOfType<PrereqCoreCredits>()
            .Which.MinCoreCredits.Should().Be(29m);
    }

    [Fact]
    public void Unknown_type_throws()
    {
        var json = """{"type":"NotARealType","whatever":1}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>().WithMessage("*NotARealType*");
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj
```

Expected: build error — types `PrereqExpression`, `PrereqCourse`, etc., and `PrereqExpressionConverter` don't exist yet.

- [ ] **Step 3: Create the abstract base**

Create `src/ISUCourseManager.Data/Entity/PrereqExpression.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

public abstract class PrereqExpression
{
}
```

- [ ] **Step 4: Create the concrete subclasses**

Create `src/ISUCourseManager.Data/Entity/PrereqAnd.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class PrereqAnd : PrereqExpression
{
    public List<PrereqExpression> Children { get; init; } = new();
}
```

Create `src/ISUCourseManager.Data/Entity/PrereqOr.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class PrereqOr : PrereqExpression
{
    public List<PrereqExpression> Children { get; init; } = new();
}
```

Create `src/ISUCourseManager.Data/Entity/PrereqCourse.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class PrereqCourse : PrereqExpression
{
    public string ClassId { get; init; } = "";
    public string? MinGrade { get; init; }
    public bool AcceptConcurrent { get; init; }
}
```

Create `src/ISUCourseManager.Data/Entity/PrereqClassification.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class PrereqClassification : PrereqExpression
{
    public Classification Min { get; init; }
}
```

Create `src/ISUCourseManager.Data/Entity/PrereqCoreCredits.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class PrereqCoreCredits : PrereqExpression
{
    public decimal MinCoreCredits { get; init; }
}
```

- [ ] **Step 5: Create the JSON converter**

Create `src/ISUCourseManager.Data/Seed/PrereqExpressionConverter.cs`:

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Data.Seed;

/// <summary>
/// Polymorphic converter for PrereqExpression that uses a "type" discriminator
/// matching the JSON seed file format.
/// </summary>
public sealed class PrereqExpressionConverter : JsonConverter<PrereqExpression>
{
    public override PrereqExpression Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        if (!root.TryGetProperty("type", out var typeProp))
            throw new JsonException("PrereqExpression node is missing 'type' field");

        var type = typeProp.GetString();
        return type switch
        {
            "Course" => new PrereqCourse
            {
                ClassId = root.GetProperty("classId").GetString() ?? "",
                MinGrade = root.TryGetProperty("minGrade", out var mg) && mg.ValueKind == JsonValueKind.String ? mg.GetString() : null,
                AcceptConcurrent = root.TryGetProperty("acceptConcurrent", out var ac) && ac.ValueKind == JsonValueKind.True,
            },
            "And" => new PrereqAnd { Children = ReadChildren(root, options) },
            "Or" => new PrereqOr { Children = ReadChildren(root, options) },
            "Classification" => new PrereqClassification
            {
                Min = Enum.Parse<Classification>(root.GetProperty("min").GetString() ?? ""),
            },
            "CoreCredits" => new PrereqCoreCredits
            {
                MinCoreCredits = root.GetProperty("minCoreCredits").GetDecimal(),
            },
            _ => throw new JsonException($"Unknown PrereqExpression type: '{type}'"),
        };
    }

    private List<PrereqExpression> ReadChildren(JsonElement root, JsonSerializerOptions options)
    {
        if (!root.TryGetProperty("children", out var children) || children.ValueKind != JsonValueKind.Array)
            return new();
        var list = new List<PrereqExpression>();
        foreach (var child in children.EnumerateArray())
        {
            var raw = child.GetRawText();
            list.Add(JsonSerializer.Deserialize<PrereqExpression>(raw, options)!);
        }
        return list;
    }

    public override void Write(Utf8JsonWriter writer, PrereqExpression value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        switch (value)
        {
            case PrereqCourse c:
                writer.WriteString("type", "Course");
                writer.WriteString("classId", c.ClassId);
                if (c.MinGrade is not null)
                    writer.WriteString("minGrade", c.MinGrade);
                if (c.AcceptConcurrent)
                    writer.WriteBoolean("acceptConcurrent", true);
                break;
            case PrereqAnd a:
                writer.WriteString("type", "And");
                writer.WritePropertyName("children");
                JsonSerializer.Serialize(writer, a.Children, options);
                break;
            case PrereqOr o:
                writer.WriteString("type", "Or");
                writer.WritePropertyName("children");
                JsonSerializer.Serialize(writer, o.Children, options);
                break;
            case PrereqClassification cl:
                writer.WriteString("type", "Classification");
                writer.WriteString("min", cl.Min.ToString());
                break;
            case PrereqCoreCredits cc:
                writer.WriteString("type", "CoreCredits");
                writer.WriteNumber("minCoreCredits", cc.MinCoreCredits);
                break;
            default:
                throw new JsonException($"Cannot serialize unknown PrereqExpression type: {value.GetType()}");
        }
        writer.WriteEndObject();
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj
```

Expected: `Passed! - Failed: 0, Passed: 7, Skipped: 0`

- [ ] **Step 7: Commit**

```
git add src/ISUCourseManager.Data/Entity/Prereq*.cs src/ISUCourseManager.Data/Seed/PrereqExpressionConverter.cs tests/ISUCourseManager.Services.Tests/PrereqExpressionConverterTests.cs
git commit -m "feat(domain): PrereqExpression hierarchy with polymorphic JSON converter"
```

---

## Task 4: Course entity

**Files:**
- Create: `src/ISUCourseManager.Data/Entity/Course.cs`

No standalone test for the POCO — it's exercised through deserialization tests in later tasks. But keep the field set complete per spec §4.

- [ ] **Step 1: Create Course.cs**

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class Course
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string ClassId { get; init; }            // "MATH-1650"
    public required string Code { get; init; }               // "Math 1650"
    public required string Name { get; init; }               // chart abbreviation
    public string? OfficialName { get; init; }               // catalog name
    public required decimal Credits { get; init; }
    public string? CreditNote { get; init; }                 // "R cr", "3/4cr"
    public required string Department { get; init; }
    public PrereqExpression? Prereqs { get; init; }
    public PrereqExpression? Coreqs { get; init; }
    public List<string> CrossListedAs { get; init; } = new();
    public List<Term> TypicallyOffered { get; init; } = new();
    public bool IsActive { get; init; } = true;
}
```

- [ ] **Step 2: Build to verify**

```
dotnet build src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Data/Entity/Course.cs
git commit -m "feat(domain): add Course entity"
```

---

## Task 5: DegreeFlow + FlowchartSlot entities

**Files:**
- Create: `src/ISUCourseManager.Data/Entity/DegreeFlow.cs`
- Create: `src/ISUCourseManager.Data/Entity/FlowchartSlot.cs`

- [ ] **Step 1: Create DegreeFlow.cs**

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class DegreeFlow
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string MajorCode { get; init; }      // "CYBE"
    public required string MajorName { get; init; }      // "Cyber Security Engineering"
    public required string CatalogYear { get; init; }    // "2025-26"
    public required int TotalCreditsRequired { get; init; }
    public List<string> Notes { get; init; } = new();
    public List<FlowchartSlot> Slots { get; init; } = new();
}
```

- [ ] **Step 2: Create FlowchartSlot.cs**

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class FlowchartSlot
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DegreeFlowId { get; init; }
    public required int Semester { get; init; }
    public required SlotType SlotType { get; init; }       // single enum: DegreeClass or Elective*
    public string? ClassId { get; init; }                  // populated when SlotType == DegreeClass
    public string? DisplayName { get; init; }              // chart abbreviation override
    public decimal? RequiredCredits { get; init; }         // null for DegreeClass (uses Course.Credits);
                                                           //   set for Elective* slots (declares budget)
    public string? CreditNote { get; init; }
    public string? MinGrade { get; init; }
    public string? ClassNote { get; init; }
    public required int DisplayOrder { get; init; }
    public List<string> RecommendedPairing { get; init; } = new();
}
```

- [ ] **Step 3: Build to verify**

```
dotnet build src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Data/Entity/DegreeFlow.cs src/ISUCourseManager.Data/Entity/FlowchartSlot.cs
git commit -m "feat(domain): add DegreeFlow and FlowchartSlot entities"
```

---

## Task 6: Student / StudentCourse / StudentDegreeFlow entities

**Files:**
- Create: `src/ISUCourseManager.Data/Entity/Student.cs`
- Create: `src/ISUCourseManager.Data/Entity/StudentCourse.cs`
- Create: `src/ISUCourseManager.Data/Entity/StudentDegreeFlow.cs`

The student's academic record (`StudentCourse`) lives directly on `Student` — no `Plan` aggregate. Degree-flow associations are a separate junction (`StudentDegreeFlow`) so a student can hold many flows simultaneously, each with its own lifecycle status (Pending exploration / Active enrollment / Deleted abandonment / Completed graduation). See spec §4 Tier 3 for the full rationale.

- [ ] **Step 1: Create Student.cs**

```csharp
namespace ISUCourseManager.Data.Entity;

public sealed class Student
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string DisplayName { get; init; }

    // Convenience navigation collections (EF maps these via FK on the child).
    public List<StudentCourse> Courses { get; init; } = new();
    public List<StudentDegreeFlow> DegreeFlows { get; init; } = new();
}
```

- [ ] **Step 2: Create StudentCourse.cs**

```csharp
namespace ISUCourseManager.Data.Entity;

/// <summary>
/// One enrollment record. Lives directly on Student — independent of any DegreeFlow,
/// so the same StudentCourse[] overlays cleanly against any flow the student is
/// associated with (Active or Pending). Status carries the lifecycle of this single
/// enrollment; AcademicTerm gives the chronological position (YYYYSS).
/// </summary>
public sealed class StudentCourse
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required Guid StudentId { get; init; }
    public required string CourseId { get; init; }            // matches Course.ClassId (e.g. "MATH-1650")
    public required int AcademicTerm { get; init; }           // YYYYSS — see AcademicTerm helper
    public required StudentCourseStatus Status { get; init; }
    public string? Grade { get; init; }                       // populated for Completed/Failed
}
```

- [ ] **Step 3: Create StudentDegreeFlow.cs**

```csharp
namespace ISUCourseManager.Data.Entity;

/// <summary>
/// Junction associating a Student with a DegreeFlow + lifecycle Status. A student
/// can have many of these — multiple Active rows model double majors; Pending rows
/// model what-if exploration without commitment. No uniqueness constraint on
/// (StudentId, Status=Active).
/// </summary>
public sealed class StudentDegreeFlow
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required Guid StudentId { get; init; }
    public required Guid DegreeFlowId { get; init; }
    public required StudentDegreeFlowStatus Status { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public DateTime? StatusChangedAt { get; init; }
}
```

- [ ] **Step 4: Build to verify**

```
dotnet build src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Data/Entity/Student.cs src/ISUCourseManager.Data/Entity/StudentCourse.cs src/ISUCourseManager.Data/Entity/StudentDegreeFlow.cs
git commit -m "feat(domain): add Student, StudentCourse, StudentDegreeFlow entities"
```

---

## Task 6b: AcademicTerm helper

**Files:**
- Create: `src/ISUCourseManager.Data/Entity/AcademicTerm.cs`
- Test: `tests/ISUCourseManager.Services.Tests/AcademicTermTests.cs`

`StudentCourse.AcademicTerm` is a 6-digit int packing `YYYY` (academic-cycle ending year) + `SS` (Season enum value). The helper makes encode/decode and term comparisons tidy. Since this is pure logic, TDD it.

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/AcademicTermTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Tests;

public class AcademicTermTests
{
    [Theory]
    [InlineData(2026, Season.Summer, 202601)]
    [InlineData(2026, Season.Fall,   202602)]
    [InlineData(2026, Season.Winter, 202603)]
    [InlineData(2026, Season.Spring, 202604)]
    public void Encode_packs_year_and_season(int year, Season season, int expected)
    {
        AcademicTerm.Encode(year, season).Should().Be(expected);
    }

    [Theory]
    [InlineData(202601, 2026, Season.Summer)]
    [InlineData(202602, 2026, Season.Fall)]
    [InlineData(202604, 2026, Season.Spring)]
    public void Decode_unpacks_year_and_season(int term, int expectedYear, Season expectedSeason)
    {
        var (y, s) = AcademicTerm.Decode(term);
        y.Should().Be(expectedYear);
        s.Should().Be(expectedSeason);
    }

    [Fact]
    public void Encoded_terms_sort_chronologically_within_a_year()
    {
        var terms = new[]
        {
            AcademicTerm.Encode(2026, Season.Spring),
            AcademicTerm.Encode(2026, Season.Summer),
            AcademicTerm.Encode(2026, Season.Winter),
            AcademicTerm.Encode(2026, Season.Fall),
        };
        terms.Order().Should().Equal(202601, 202602, 202603, 202604);
    }

    [Fact]
    public void Encoded_terms_sort_chronologically_across_years()
    {
        AcademicTerm.Encode(2025, Season.Spring).Should().BeLessThan(AcademicTerm.Encode(2026, Season.Summer));
    }

    [Fact]
    public void Decode_throws_on_invalid_season()
    {
        Action act = () => AcademicTerm.Decode(202699);  // 99 isn't a valid Season
        act.Should().Throw<ArgumentException>();
    }
}
```

- [ ] **Step 2: Run tests to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~AcademicTermTests"
```

Expected: build error — `AcademicTerm` class doesn't exist yet.

- [ ] **Step 3: Create AcademicTerm.cs**

```csharp
namespace ISUCourseManager.Data.Entity;

/// <summary>
/// Encode/decode for the YYYYSS AcademicTerm packed-int format.
/// Year is the *ending* year of the academic cycle (school year 2025-26 → 2026).
/// Season values: Summer=1, Fall=2, Winter=3, Spring=4 (chronological within year).
/// </summary>
public static class AcademicTerm
{
    public static int Encode(int year, Season season)
        => year * 100 + (int)season;

    public static (int Year, Season Season) Decode(int term)
    {
        var year = term / 100;
        var seasonInt = term % 100;
        if (!Enum.IsDefined(typeof(Season), seasonInt))
            throw new ArgumentException($"Invalid season {seasonInt} in AcademicTerm {term}", nameof(term));
        return (year, (Season)seasonInt);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~AcademicTermTests"
```

Expected: `Passed! - Failed: 0, Passed: 5, Skipped: 0`

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Data/Entity/AcademicTerm.cs tests/ISUCourseManager.Services.Tests/AcademicTermTests.cs
git commit -m "feat(domain): AcademicTerm encode/decode helper with Season enum"
```

---

## Task 7: Repo-paths test helper

**Files:**
- Create: `tests/ISUCourseManager.Services.Tests/Helpers/RepoPaths.cs`

Tests need to find `Data/cybe_flowchart.json` and `Documentation/seed-templates/isu-catalog.json` from the test bin directory. The helper walks up from the assembly location until it finds the solution file.

- [ ] **Step 1: Create RepoPaths.cs**

```csharp
using System.IO;
using System.Reflection;

namespace ISUCourseManager.Services.Tests.Helpers;

internal static class RepoPaths
{
    public static string SolutionRoot { get; } = FindSolutionRoot();
    public static string CatalogJsonPath => Path.Combine(SolutionRoot, "Documentation", "seed-templates", "isu-catalog.json");
    public static string CybeFlowJsonPath => Path.Combine(SolutionRoot, "Data", "cybe_flowchart.json");

    private static string FindSolutionRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)!);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "ISUCourseManager.sln")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Could not locate ISUCourseManager.sln walking up from test bin dir");
    }
}
```

- [ ] **Step 2: Add a smoke test that the paths resolve**

Create `tests/ISUCourseManager.Services.Tests/SeedLoaderTests.cs`. **Declare the class as `partial`** — later tasks (8, 9) will append more `[Fact]` methods to the same class via additional partial-class files, so we set up the partial-class pattern from the start:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Seed;
using ISUCourseManager.Services.Tests.Helpers;

namespace ISUCourseManager.Services.Tests;

public partial class SeedLoaderTests
{
    [Fact]
    public void Repo_paths_resolve_to_existing_files()
    {
        File.Exists(RepoPaths.CatalogJsonPath).Should().BeTrue($"expected {RepoPaths.CatalogJsonPath}");
        File.Exists(RepoPaths.CybeFlowJsonPath).Should().BeTrue($"expected {RepoPaths.CybeFlowJsonPath}");
    }
}
```

(The `using ISUCourseManager.Data.Entity` and `using ISUCourseManager.Data.Seed` lines are unused right now but will be needed by tasks 8 and 9. Including them up front avoids a multi-file edit later. The `TreatWarningsAsErrors` flag is OFF for the test project per Task 1 Step 8, so unused-using warnings won't fail the build.)

- [ ] **Step 3: Run the test to verify it passes**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~Repo_paths_resolve"
```

Expected: `Passed! - Failed: 0, Passed: 1, Skipped: 0`

- [ ] **Step 4: Commit**

```
git add tests/ISUCourseManager.Services.Tests/Helpers/RepoPaths.cs tests/ISUCourseManager.Services.Tests/SeedLoaderTests.cs
git commit -m "test: add RepoPaths helper for resolving seed-file locations"
```

---

## Task 8: Catalog JSON DTO and SeedLoader.LoadCatalog

**Files:**
- Create: `src/ISUCourseManager.Data/Seed/Json/CatalogJson.cs`
- Create: `src/ISUCourseManager.Data/Seed/SeedLoader.cs`
- Modify: `tests/ISUCourseManager.Services.Tests/SeedLoaderTests.cs`

We use internal DTOs that mirror the JSON shape, then map to domain entities. This decouples the wire format from the entity definitions and lets us evolve them independently.

- [ ] **Step 1: Write failing test for loading the actual catalog file**

Create a new file `tests/ISUCourseManager.Services.Tests/SeedLoaderTests.LoadCatalog.cs` (separate partial-class file — keeps growth manageable):

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Seed;
using ISUCourseManager.Services.Tests.Helpers;

namespace ISUCourseManager.Services.Tests;

public partial class SeedLoaderTests
{
    [Fact]
    public void LoadCatalog_returns_courses_from_actual_seed_file()
    {
        var catalog = SeedLoader.LoadCatalog(RepoPaths.CatalogJsonPath);

        catalog.Should().NotBeNull();
        catalog.Should().HaveCountGreaterThan(30, "the seed file has ~40 courses");

        var math1650 = catalog.SingleOrDefault(c => c.ClassId == "MATH-1650");
        math1650.Should().NotBeNull();
        math1650!.Code.Should().Be("Math 1650");
        math1650.Credits.Should().Be(4m);
        math1650.Department.Should().Be("Math");
    }

    [Fact]
    public void LoadCatalog_parses_cross_listings()
    {
        var catalog = SeedLoader.LoadCatalog(RepoPaths.CatalogJsonPath);
        var cybe2300 = catalog.Single(c => c.ClassId == "CYBE-2300");
        cybe2300.CrossListedAs.Should().Contain("CPRE-2300");
    }

    [Fact]
    public void LoadCatalog_parses_term_offerings()
    {
        var catalog = SeedLoader.LoadCatalog(RepoPaths.CatalogJsonPath);
        var coms3110 = catalog.SingleOrDefault(c => c.ClassId == "COMS-3110");
        coms3110.Should().NotBeNull();
        coms3110!.TypicallyOffered.Should().NotBeEmpty();
    }

    [Fact]
    public void LoadCatalog_parses_R_credit_courses_with_creditNote()
    {
        var catalog = SeedLoader.LoadCatalog(RepoPaths.CatalogJsonPath);
        var engr1010 = catalog.Single(c => c.ClassId == "ENGR-1010");
        engr1010.Credits.Should().Be(0m);
        engr1010.CreditNote.Should().Be("R cr");
    }
}
```

This is a separate `.cs` file that combines with `SeedLoaderTests.cs` (declared `partial` in Task 7) at compile time — no editing of the previous task's file required.

- [ ] **Step 2: Run the tests to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~LoadCatalog"
```

Expected: build error — `SeedLoader.LoadCatalog` doesn't exist.

- [ ] **Step 3: Create the catalog DTO**

Create `src/ISUCourseManager.Data/Seed/Json/CatalogJson.cs`:

```csharp
using System.Text.Json.Serialization;
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Data.Seed.Json;

internal sealed class CatalogJsonRoot
{
    [JsonPropertyName("_comment")] public string? Comment { get; init; }
    [JsonPropertyName("courses")] public List<CourseJson> Courses { get; init; } = new();
}

internal sealed class CourseJson
{
    [JsonPropertyName("classId")] public string ClassId { get; init; } = "";
    [JsonPropertyName("code")] public string Code { get; init; } = "";
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("officialName")] public string? OfficialName { get; init; }
    [JsonPropertyName("credits")] public decimal? Credits { get; init; }
    [JsonPropertyName("creditNote")] public string? CreditNote { get; init; }
    [JsonPropertyName("department")] public string Department { get; init; } = "";
    [JsonPropertyName("prereqs")] public PrereqExpression? Prereqs { get; init; }
    [JsonPropertyName("coreqs")] public PrereqExpression? Coreqs { get; init; }
    [JsonPropertyName("crossListedAs")] public List<string> CrossListedAs { get; init; } = new();
    [JsonPropertyName("typicallyOffered")] public List<string> TypicallyOffered { get; init; } = new();
    [JsonPropertyName("isActive")] public bool IsActive { get; init; } = true;
}
```

- [ ] **Step 4: Create the SeedLoader**

Create `src/ISUCourseManager.Data/Seed/SeedLoader.cs`:

```csharp
using System.Text.Json;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Seed.Json;

namespace ISUCourseManager.Data.Seed;

public static class SeedLoader
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new PrereqExpressionConverter() },
    };

    public static IReadOnlyList<Course> LoadCatalog(string jsonFilePath)
    {
        var json = File.ReadAllText(jsonFilePath);
        var root = JsonSerializer.Deserialize<CatalogJsonRoot>(json, Options)
                   ?? throw new InvalidDataException($"Catalog JSON at {jsonFilePath} deserialized to null");

        return root.Courses.Select(MapCourse).ToList();
    }

    private static Course MapCourse(CourseJson c)
    {
        var typicallyOffered = c.TypicallyOffered
            .Select(t => Enum.TryParse<Term>(t, out var v) ? (Term?)v : null)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        // Normalize cross-listed codes: "CPRE 2300" or "CPRE-2300" -> "CPRE-2300"
        var crossListed = c.CrossListedAs
            .Select(NormalizeClassId)
            .ToList();

        return new Course
        {
            ClassId = c.ClassId,
            Code = c.Code,
            Name = c.Name ?? c.OfficialName ?? c.Code,
            OfficialName = c.OfficialName,
            Credits = c.Credits ?? 0m,
            CreditNote = c.CreditNote,
            Department = c.Department,
            Prereqs = c.Prereqs,
            Coreqs = c.Coreqs,
            CrossListedAs = crossListed,
            TypicallyOffered = typicallyOffered,
            IsActive = c.IsActive,
        };
    }

    private static string NormalizeClassId(string raw)
    {
        var trimmed = raw.Trim().Replace(" ", " ");
        if (trimmed.Contains('-')) return trimmed;
        // Use LastIndexOf so compound department names ("Com S 2270") collapse correctly:
        //   "Com S 2270" -> "ComS-2270", not "Com-S 2270".
        var lastSpace = trimmed.LastIndexOf(' ');
        return lastSpace > 0
            ? $"{trimmed[..lastSpace].Replace(" ", "")}-{trimmed[(lastSpace + 1)..]}"
            : trimmed;
    }
}
```

- [ ] **Step 5: Add PrereqUnparsed escape-hatch type**

The catalog file has ~12 `_unparsed` prereq strings (raw catalog text that wasn't auto-converted to a structured tree). Without an escape hatch, the converter rejects them and `LoadCatalog` blows up. Add a placeholder node type so they round-trip cleanly:

Create `src/ISUCourseManager.Data/Entity/PrereqUnparsed.cs`:

```csharp
namespace ISUCourseManager.Data.Entity;

/// <summary>
/// Escape-hatch node for prereq strings the catalog generator could not
/// auto-convert to a structured tree. Carries the raw catalog text for
/// human review. Cascade engine treats these as "unknown — fail safe."
/// </summary>
public sealed class PrereqUnparsed : PrereqExpression
{
    public required string Raw { get; init; }
}
```

Then update `src/ISUCourseManager.Data/Seed/PrereqExpressionConverter.cs`:

In the `Read` method, *before* the `if (!root.TryGetProperty("type", out var typeProp))` line, add:

```csharp
        // Escape hatch: nodes shaped { "_unparsed": "raw catalog text" }
        if (root.TryGetProperty("_unparsed", out var u))
            return new PrereqUnparsed { Raw = u.GetString() ?? "" };
```

In the `Write` method's switch, add a case:

```csharp
            case PrereqUnparsed pu:
                writer.WriteString("_unparsed", pu.Raw);
                break;
```

Note: `PrereqUnparsed` JSON has no `type` field — it's identified solely by the `_unparsed` key. The converter's switch above runs `WriteEndObject` after the case, so this works.

Wait — looking at the converter, every other case also writes `"type"`. For `PrereqUnparsed` we deliberately don't (the `_unparsed` key serves the same purpose). Make sure you're appending the `case PrereqUnparsed` block inside the existing switch block, which already handles `WriteStartObject` / `WriteEndObject` outside the switch.

- [ ] **Step 6: Run the tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~LoadCatalog"
```

Expected: `Passed! - Failed: 0, Passed: 4, Skipped: 0`

- [ ] **Step 7: Commit**

```
git add src/ISUCourseManager.Data/Seed/Json/CatalogJson.cs src/ISUCourseManager.Data/Seed/SeedLoader.cs src/ISUCourseManager.Data/Entity/PrereqUnparsed.cs src/ISUCourseManager.Data/Seed/PrereqExpressionConverter.cs tests/ISUCourseManager.Services.Tests/SeedLoaderTests.LoadCatalog.cs
git commit -m "feat(seed): SeedLoader.LoadCatalog with PrereqUnparsed escape hatch for raw strings"
```

---

## Task 9: Flow JSON DTO and SeedLoader.LoadFlow

**Files:**
- Create: `src/ISUCourseManager.Data/Seed/Json/FlowJson.cs`
- Modify: `src/ISUCourseManager.Data/Seed/SeedLoader.cs`
- Modify: `tests/ISUCourseManager.Services.Tests/SeedLoaderTests.cs`

- [ ] **Step 1: Write failing tests**

Create a new file `tests/ISUCourseManager.Services.Tests/SeedLoaderTests.LoadFlow.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Seed;
using ISUCourseManager.Services.Tests.Helpers;

namespace ISUCourseManager.Services.Tests;

public partial class SeedLoaderTests
{
    [Fact]
    public void LoadFlow_returns_DegreeFlow_with_slots()
{
    var flow = SeedLoader.LoadFlow(RepoPaths.CybeFlowJsonPath);
    flow.Should().NotBeNull();
    flow.MajorCode.Should().Be("CYBE");
    flow.CatalogYear.Should().Be("2025-26");
    flow.TotalCreditsRequired.Should().Be(125);
    flow.Slots.Should().HaveCountGreaterOrEqualTo(40);
}

[Fact]
public void LoadFlow_parses_DegreeClass_slot()
{
    var flow = SeedLoader.LoadFlow(RepoPaths.CybeFlowJsonPath);
    var math1650 = flow.Slots.Single(s => s.ClassId == "MATH-1650");
    math1650.SlotType.Should().Be(SlotType.DegreeClass);
    math1650.Semester.Should().Be(1);
    math1650.RequiredCredits.Should().BeNull("DegreeClass slots use Course.Credits, not slot-level credits");
    math1650.MinGrade.Should().Be("C-");
}

[Fact]
public void LoadFlow_parses_Elective_slot()
{
    var flow = SeedLoader.LoadFlow(RepoPaths.CybeFlowJsonPath);
    var anyGenEd = flow.Slots.FirstOrDefault(s => s.SlotType == SlotType.ElectiveGenEd);
    anyGenEd.Should().NotBeNull();
    anyGenEd!.ClassId.Should().BeNull();
    anyGenEd.RequiredCredits.Should().BeGreaterThan(0m, "Elective* slots declare their credit budget");
}

[Fact]
public void LoadFlow_parses_recommendedPairing()
{
    var flow = SeedLoader.LoadFlow(RepoPaths.CybeFlowJsonPath);
    var cpre1850 = flow.Slots.Single(s => s.ClassId == "CPRE-1850");
    cpre1850.RecommendedPairing.Should().Contain("MATH-1650");
}

[Fact]
public void LoadFlow_parses_top_level_notes()
{
    var flow = SeedLoader.LoadFlow(RepoPaths.CybeFlowJsonPath);
    flow.Notes.Should().NotBeEmpty();
    flow.Notes.Should().Contain(n => n.Contains("flowchart is only a guide"));
}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~LoadFlow"
```

Expected: build error — `SeedLoader.LoadFlow` doesn't exist.

- [ ] **Step 3: Create the flow DTO**

Create `src/ISUCourseManager.Data/Seed/Json/FlowJson.cs`:

```csharp
using System.Text.Json.Serialization;

namespace ISUCourseManager.Data.Seed.Json;

internal sealed class FlowJsonRoot
{
    [JsonPropertyName("code")] public string Code { get; init; } = "";
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("catalogYear")] public string CatalogYear { get; init; } = "";
    [JsonPropertyName("totalCreditsRequired")] public int TotalCreditsRequired { get; init; }
    [JsonPropertyName("notes")] public List<string> Notes { get; init; } = new();
    [JsonPropertyName("slots")] public List<SlotJson> Slots { get; init; } = new();
}

internal sealed class SlotJson
{
    [JsonPropertyName("semester")] public int Semester { get; init; }
    [JsonPropertyName("slotType")] public string SlotType { get; init; } = "DegreeClass";
    [JsonPropertyName("classId")] public string? ClassId { get; init; }
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("requiredCredits")] public decimal? RequiredCredits { get; init; }
    [JsonPropertyName("creditNote")] public string? CreditNote { get; init; }
    [JsonPropertyName("minGrade")] public string? MinGrade { get; init; }
    [JsonPropertyName("classNote")] public string? ClassNote { get; init; }
    [JsonPropertyName("displayOrder")] public int DisplayOrder { get; init; }
    [JsonPropertyName("recommendedPairing")] public List<string> RecommendedPairing { get; init; } = new();
}
```

- [ ] **Step 4: Add LoadFlow to SeedLoader.cs**

Append inside the `SeedLoader` static class:

```csharp
public static DegreeFlow LoadFlow(string jsonFilePath)
{
    var json = File.ReadAllText(jsonFilePath);
    var root = JsonSerializer.Deserialize<FlowJsonRoot>(json, Options)
               ?? throw new InvalidDataException($"Flow JSON at {jsonFilePath} deserialized to null");

    var flow = new DegreeFlow
    {
        MajorCode = root.Code,
        MajorName = root.Name,
        CatalogYear = root.CatalogYear,
        TotalCreditsRequired = root.TotalCreditsRequired,
        Notes = root.Notes.ToList(),  // copy so DTO and entity don't share the list
    };

    flow.Slots.AddRange(root.Slots.Select(s => MapSlot(s, flow.Id)));
    return flow;
}

private static FlowchartSlot MapSlot(SlotJson s, Guid degreeFlowId)
{
    var slotType = Enum.Parse<SlotType>(s.SlotType);
    return new FlowchartSlot
    {
        DegreeFlowId = degreeFlowId,
        Semester = s.Semester,
        SlotType = slotType,
        ClassId = s.ClassId,
        DisplayName = s.Name,
        RequiredCredits = s.RequiredCredits,   // nullable; only Elective* slots set this
        CreditNote = s.CreditNote,
        MinGrade = s.MinGrade,
        ClassNote = s.ClassNote,
        DisplayOrder = s.DisplayOrder,
        RecommendedPairing = s.RecommendedPairing.ToList(),
    };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~LoadFlow"
```

Expected: `Passed! - Failed: 0, Passed: 5, Skipped: 0`

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Data/Seed/Json/FlowJson.cs src/ISUCourseManager.Data/Seed/SeedLoader.cs tests/ISUCourseManager.Services.Tests/SeedLoaderTests.LoadFlow.cs
git commit -m "feat(seed): add SeedLoader.LoadFlow"
```

---

## Task 10: ValidationIssue + ValidationReport types

**Files:**
- Create: `src/ISUCourseManager.Services/Validation/ValidationIssue.cs`
- Create: `src/ISUCourseManager.Services/Validation/ValidationReport.cs`

- [ ] **Step 1: Create ValidationIssue.cs**

```csharp
namespace ISUCourseManager.Services.Validation;

public enum SeedIssueKind
{
    DuplicateClassId,
    MissingClassId,
    OrphanFlowReference,
    OrphanPrereqReference,
    OrphanCrossListing,
    OrphanRecommendedPairingClass,    // pairing references a classId not in the catalog
    PairingClassNotInFlow,            // pairing references a class in catalog but not in this flow (warning)
    DuplicateSlotPosition,
    CreditTotalMismatch,
    UnparsedPrereqString,
    InvalidGrade,
    MissingElectiveCredits,           // Elective* slot has no requiredCredits
    RedundantSlotCredits,             // DegreeClass slot has requiredCredits set (warning)
    UnexpectedClassIdOnElective,      // Elective* slot has classId set (warning)
}

public enum IssueSeverity
{
    Error,
    Warning,
}

public sealed record ValidationIssue(
    SeedIssueKind Kind,
    IssueSeverity Severity,
    string Message,
    string? Location = null);
```

- [ ] **Step 2: Create ValidationReport.cs**

```csharp
namespace ISUCourseManager.Services.Validation;

public sealed class ValidationReport
{
    private readonly List<ValidationIssue> _issues = new();

    public IReadOnlyList<ValidationIssue> Issues => _issues;
    public IEnumerable<ValidationIssue> Errors => _issues.Where(i => i.Severity == IssueSeverity.Error);
    public IEnumerable<ValidationIssue> Warnings => _issues.Where(i => i.Severity == IssueSeverity.Warning);

    public bool IsValid => !Errors.Any();

    public void Add(SeedIssueKind kind, IssueSeverity severity, string message, string? location = null)
        => _issues.Add(new ValidationIssue(kind, severity, message, location));

    public override string ToString() =>
        Issues.Count == 0
            ? "No issues."
            : string.Join("\n", Issues.Select(i => $"[{i.Severity}] {i.Kind}: {i.Message}{(i.Location is null ? "" : $" ({i.Location})")}"));
}
```

- [ ] **Step 3: Build to verify**

```
dotnet build src/ISUCourseManager.Services/ISUCourseManager.Services.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Services/Validation/
git commit -m "feat(validation): add ValidationIssue and ValidationReport types"
```

---

## Task 11: SeedValidator — duplicate-classId check

**Files:**
- Create: `src/ISUCourseManager.Services/Validation/SeedValidator.cs`
- Create: `tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Services.Validation;

namespace ISUCourseManager.Services.Tests;

public class SeedValidatorTests
{
    private static Course MakeCourse(string classId, string dept = "Math") => new()
    {
        ClassId = classId,
        Code = classId.Replace("-", " "),
        Name = classId,
        Credits = 3m,
        Department = dept,
    };

    [Fact]
    public void DuplicateClassId_in_catalog_emits_error()
    {
        var catalog = new[]
        {
            MakeCourse("MATH-1650"),
            MakeCourse("MATH-1650"),  // duplicate!
        };

        var report = SeedValidator.ValidateCatalog(catalog);

        report.Errors.Should().ContainSingle()
            .Which.Kind.Should().Be(SeedIssueKind.DuplicateClassId);
    }

    [Fact]
    public void Unique_classIds_in_catalog_passes()
    {
        var catalog = new[]
        {
            MakeCourse("MATH-1650"),
            MakeCourse("MATH-1660"),
            MakeCourse("CPRE-1850"),
        };

        var report = SeedValidator.ValidateCatalog(catalog);

        report.IsValid.Should().BeTrue($"got: {report}");
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~SeedValidatorTests"
```

Expected: build error — `SeedValidator` doesn't exist.

- [ ] **Step 3: Create SeedValidator.cs**

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Validation;

public static class SeedValidator
{
    public static ValidationReport ValidateCatalog(IEnumerable<Course> catalog)
    {
        var report = new ValidationReport();
        var courses = catalog.ToList();
        CheckDuplicateClassIds(courses, report);
        return report;
    }

    private static void CheckDuplicateClassIds(IList<Course> courses, ValidationReport report)
    {
        var dupes = courses
            .GroupBy(c => c.ClassId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dupe in dupes)
        {
            report.Add(
                SeedIssueKind.DuplicateClassId,
                IssueSeverity.Error,
                $"Catalog has {courses.Count(c => c.ClassId == dupe)} entries for classId '{dupe}'",
                location: $"catalog:{dupe}");
        }
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~SeedValidatorTests"
```

Expected: `Passed! - Failed: 0, Passed: 2, Skipped: 0`

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Validation/SeedValidator.cs tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs
git commit -m "feat(validation): SeedValidator detects duplicate classIds"
```

---

## Task 12: SeedValidator — orphan cross-listings + prereq references

**Files:**
- Modify: `src/ISUCourseManager.Services/Validation/SeedValidator.cs`
- Modify: `tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs`

- [ ] **Step 1: Append failing tests**

Append to `tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs` inside `SeedValidatorTests`:

```csharp
[Fact]
public void CrossListing_to_unknown_classId_emits_error()
{
    var catalog = new[]
    {
        new Course
        {
            ClassId = "CYBE-2300", Code = "Cyb E 2300", Name = "Cyber Sec",
            Credits = 3, Department = "CybE",
            CrossListedAs = new() { "PHANTOM-9999" },
        },
        MakeCourse("MATH-1650"),
    };

    var report = SeedValidator.ValidateCatalog(catalog);

    report.Errors.Should().ContainSingle()
        .Which.Kind.Should().Be(SeedIssueKind.OrphanCrossListing);
}

[Fact]
public void Prereq_referencing_unknown_classId_emits_error()
{
    var catalog = new[]
    {
        new Course
        {
            ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II",
            Credits = 4, Department = "Math",
            Prereqs = new PrereqCourse { ClassId = "PHANTOM-9999" },
        },
    };

    var report = SeedValidator.ValidateCatalog(catalog);

    report.Errors.Should().Contain(i => i.Kind == SeedIssueKind.OrphanPrereqReference);
}

[Fact]
public void Prereq_with_nested_Or_validates_all_leaves()
{
    var catalog = new[]
    {
        MakeCourse("MATH-1650"),
        new Course
        {
            ClassId = "CPRE-3000", Code = "CprE 3000", Name = "Test",
            Credits = 3, Department = "CprE",
            Prereqs = new PrereqOr
            {
                Children = new()
                {
                    new PrereqCourse { ClassId = "MATH-1650" },         // OK
                    new PrereqCourse { ClassId = "PHANTOM-9999" },      // orphan
                },
            },
        },
    };

    var report = SeedValidator.ValidateCatalog(catalog);

    report.Errors.Should().Contain(i => i.Kind == SeedIssueKind.OrphanPrereqReference
                                        && i.Message.Contains("PHANTOM-9999"));
}

[Fact]
public void Unparsed_prereq_emits_warning_not_error()
{
    var catalog = new[]
    {
        new Course
        {
            ClassId = "FOO-100", Code = "Foo 100", Name = "Foo", Credits = 3, Department = "Foo",
            Prereqs = new PrereqUnparsed { Raw = "complex string" },
        },
    };

    var report = SeedValidator.ValidateCatalog(catalog);

    report.IsValid.Should().BeTrue("unparsed is a warning, not an error");
    report.Warnings.Should().ContainSingle()
        .Which.Kind.Should().Be(SeedIssueKind.UnparsedPrereqString);
}
```

- [ ] **Step 2: Run tests to verify failure**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~SeedValidatorTests"
```

Expected: 4 new tests fail, 2 previous pass.

- [ ] **Step 3: Extend SeedValidator with cross-listing + prereq checks**

Replace `SeedValidator.cs` body with:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Validation;

public static class SeedValidator
{
    public static ValidationReport ValidateCatalog(IEnumerable<Course> catalog)
    {
        var report = new ValidationReport();
        var courses = catalog.ToList();
        var classIds = courses.Select(c => c.ClassId).ToHashSet();

        CheckDuplicateClassIds(courses, report);
        CheckCrossListings(courses, classIds, report);
        CheckPrereqReferences(courses, classIds, report);
        return report;
    }

    private static void CheckDuplicateClassIds(IList<Course> courses, ValidationReport report)
    {
        var dupes = courses
            .GroupBy(c => c.ClassId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dupe in dupes)
            report.Add(SeedIssueKind.DuplicateClassId, IssueSeverity.Error,
                $"Catalog has {courses.Count(c => c.ClassId == dupe)} entries for classId '{dupe}'",
                location: $"catalog:{dupe}");
    }

    private static void CheckCrossListings(IList<Course> courses, HashSet<string> classIds, ValidationReport report)
    {
        foreach (var c in courses)
        {
            foreach (var xl in c.CrossListedAs)
            {
                if (!classIds.Contains(xl))
                    report.Add(SeedIssueKind.OrphanCrossListing, IssueSeverity.Error,
                        $"{c.ClassId} is cross-listed with {xl}, but {xl} is not in the catalog",
                        location: $"catalog:{c.ClassId}.crossListedAs[{xl}]");
            }
        }
    }

    private static void CheckPrereqReferences(IList<Course> courses, HashSet<string> classIds, ValidationReport report)
    {
        foreach (var c in courses)
        {
            VisitTree(c.Prereqs, c.ClassId, "prereqs", classIds, report);
            VisitTree(c.Coreqs, c.ClassId, "coreqs", classIds, report);
        }
    }

    private static void VisitTree(PrereqExpression? node, string ownerClassId, string fieldName, HashSet<string> classIds, ValidationReport report)
    {
        switch (node)
        {
            case null: return;
            case PrereqAnd a:
                foreach (var child in a.Children) VisitTree(child, ownerClassId, fieldName, classIds, report);
                break;
            case PrereqOr o:
                foreach (var child in o.Children) VisitTree(child, ownerClassId, fieldName, classIds, report);
                break;
            case PrereqCourse pc:
                if (!classIds.Contains(pc.ClassId))
                    report.Add(SeedIssueKind.OrphanPrereqReference, IssueSeverity.Error,
                        $"{ownerClassId}.{fieldName} references unknown class '{pc.ClassId}'",
                        location: $"catalog:{ownerClassId}.{fieldName}");
                break;
            case PrereqUnparsed pu:
                report.Add(SeedIssueKind.UnparsedPrereqString, IssueSeverity.Warning,
                    $"{ownerClassId}.{fieldName} contains unparsed string: \"{pu.Raw}\"",
                    location: $"catalog:{ownerClassId}.{fieldName}");
                break;
            // PrereqClassification and PrereqCoreCredits don't reference courses; nothing to check.
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~SeedValidatorTests"
```

Expected: `Passed! - Failed: 0, Passed: 6, Skipped: 0`

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Validation/SeedValidator.cs tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs
git commit -m "feat(validation): catalog cross-listing and prereq reference checks"
```

---

## Task 13: SeedValidator — flow integrity (orphan classIds, dup positions, recommendedPairing)

**Files:**
- Modify: `src/ISUCourseManager.Services/Validation/SeedValidator.cs`
- Modify: `tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs`

- [ ] **Step 1: Append failing tests**

Append to `SeedValidatorTests`:

```csharp
private static FlowchartSlot MakeSlot(int sem, int order, string? classId = null,
                                      SlotType slotType = SlotType.DegreeClass,
                                      decimal? credits = null, params string[] pairing) => new()
{
    Semester = sem,
    DisplayOrder = order,
    SlotType = slotType,
    ClassId = classId,
    // For DegreeClass slots, credits are null (read from Course.Credits); for Elective* slots, credits is set.
    RequiredCredits = slotType == SlotType.DegreeClass ? null : (credits ?? 3m),
    RecommendedPairing = pairing.ToList(),
};

[Fact]
public void Flow_with_classId_not_in_catalog_emits_error()
{
    var catalog = new[] { MakeCourse("MATH-1650") };
    var flow = new DegreeFlow
    {
        MajorCode = "X", MajorName = "X", CatalogYear = "Y", TotalCreditsRequired = 6,
        Slots = { MakeSlot(1, 1, classId: "MATH-1650", credits: 3),
                  MakeSlot(1, 2, classId: "PHANTOM-1234", credits: 3) },
    };

    var report = SeedValidator.ValidateFlow(flow, catalog);

    report.Errors.Should().Contain(i => i.Kind == SeedIssueKind.OrphanFlowReference
                                        && i.Message.Contains("PHANTOM-1234"));
}

[Fact]
public void Flow_with_duplicate_semester_displayOrder_pair_emits_error()
{
    var catalog = new[] { MakeCourse("MATH-1650"), MakeCourse("MATH-1660") };
    var flow = new DegreeFlow
    {
        MajorCode = "X", MajorName = "X", CatalogYear = "Y", TotalCreditsRequired = 8,
        Slots = { MakeSlot(1, 1, classId: "MATH-1650", credits: 4),
                  MakeSlot(1, 1, classId: "MATH-1660", credits: 4) },  // dup (1,1)
    };

    var report = SeedValidator.ValidateFlow(flow, catalog);

    report.Errors.Should().Contain(i => i.Kind == SeedIssueKind.DuplicateSlotPosition);
}

[Fact]
public void Flow_recommendedPairing_referencing_unknown_classId_emits_error()
{
    var catalog = new[] { MakeCourse("CPRE-1850") };
    var flow = new DegreeFlow
    {
        MajorCode = "X", MajorName = "X", CatalogYear = "Y", TotalCreditsRequired = 3,
        Slots = { MakeSlot(1, 1, classId: "CPRE-1850", credits: 3, pairing: "PHANTOM-1234") },
    };

    var report = SeedValidator.ValidateFlow(flow, catalog);

    report.Errors.Should().Contain(i => i.Kind == SeedIssueKind.OrphanRecommendedPairingClass
                                        && i.Message.Contains("PHANTOM-1234"));
}

[Fact]
public void Flow_recommendedPairing_referencing_classId_not_in_same_flow_emits_warning()
{
    var catalog = new[] { MakeCourse("CPRE-1850"), MakeCourse("MATH-1650") };
    var flow = new DegreeFlow
    {
        MajorCode = "X", MajorName = "X", CatalogYear = "Y", TotalCreditsRequired = 3,
        Slots = { MakeSlot(1, 1, classId: "CPRE-1850", credits: 3, pairing: "MATH-1650") },
        // MATH-1650 is in the catalog but NOT in this flow
    };

    var report = SeedValidator.ValidateFlow(flow, catalog);

    report.IsValid.Should().BeTrue();  // warning, not error
    report.Warnings.Should().ContainSingle()
        .Which.Kind.Should().Be(SeedIssueKind.PairingClassNotInFlow);
}

[Fact]
public void Flow_credit_total_not_matching_sum_emits_warning()
{
    var catalog = new[] { MakeCourse("MATH-1650"), MakeCourse("MATH-1660") };  // each 3 cr
    var flow = new DegreeFlow
    {
        MajorCode = "X", MajorName = "X", CatalogYear = "Y",
        TotalCreditsRequired = 100, // intentional mismatch — actual sum is 6 (3+3 from Course.Credits)
        Slots = { MakeSlot(1, 1, classId: "MATH-1650"),
                  MakeSlot(2, 1, classId: "MATH-1660") },
    };

    var report = SeedValidator.ValidateFlow(flow, catalog);

    report.Warnings.Should().Contain(i => i.Kind == SeedIssueKind.CreditTotalMismatch);
}
```

- [ ] **Step 2: Run tests to verify they fail**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~SeedValidatorTests"
```

Expected: 5 new failing tests; 6 previous passing.

- [ ] **Step 3: Add ValidateFlow to SeedValidator**

Append inside the `SeedValidator` static class:

```csharp
public static ValidationReport ValidateFlow(DegreeFlow flow, IEnumerable<Course> catalog)
{
    var report = new ValidationReport();
    var classIds = catalog.Select(c => c.ClassId).ToHashSet();
    var slotClassIds = flow.Slots
        .Where(s => s.ClassId is not null)
        .Select(s => s.ClassId!)
        .ToHashSet();

    foreach (var slot in flow.Slots)
    {
        if (slot.SlotType == SlotType.DegreeClass)
        {
            if (slot.ClassId is null)
                report.Add(SeedIssueKind.MissingClassId, IssueSeverity.Error,
                    $"Slot at semester {slot.Semester} order {slot.DisplayOrder} is DegreeClass but has no classId",
                    location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
            else if (!classIds.Contains(slot.ClassId))
                report.Add(SeedIssueKind.OrphanFlowReference, IssueSeverity.Error,
                    $"Slot references classId '{slot.ClassId}' not in catalog",
                    location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
            if (slot.RequiredCredits is not null)
                report.Add(SeedIssueKind.RedundantSlotCredits, IssueSeverity.Warning,
                    $"DegreeClass slot for {slot.ClassId} declares requiredCredits={slot.RequiredCredits} — should be null (use Course.Credits)",
                    location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
        }
        else  // Elective* slot
        {
            if (slot.RequiredCredits is null)
                report.Add(SeedIssueKind.MissingElectiveCredits, IssueSeverity.Error,
                    $"Elective slot ({slot.SlotType}) at semester {slot.Semester} order {slot.DisplayOrder} has no requiredCredits",
                    location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
            if (slot.ClassId is not null)
                report.Add(SeedIssueKind.UnexpectedClassIdOnElective, IssueSeverity.Warning,
                    $"Elective slot ({slot.SlotType}) at semester {slot.Semester} order {slot.DisplayOrder} has classId='{slot.ClassId}' — should be null",
                    location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
        }

        foreach (var pairing in slot.RecommendedPairing)
        {
            if (!classIds.Contains(pairing))
                report.Add(SeedIssueKind.OrphanRecommendedPairingClass, IssueSeverity.Error,
                    $"Slot {slot.ClassId} pairs with '{pairing}' which is not in the catalog",
                    location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}].recommendedPairing");
            else if (!slotClassIds.Contains(pairing))
                report.Add(SeedIssueKind.PairingClassNotInFlow, IssueSeverity.Warning,
                    $"Slot {slot.ClassId} pairs with '{pairing}' which exists in catalog but not in this flow",
                    location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}].recommendedPairing");
        }
    }

    var dupePositions = flow.Slots
        .GroupBy(s => (s.Semester, s.DisplayOrder))
        .Where(g => g.Count() > 1);

    foreach (var dupe in dupePositions)
        report.Add(SeedIssueKind.DuplicateSlotPosition, IssueSeverity.Error,
            $"{dupe.Count()} slots share semester {dupe.Key.Semester} displayOrder {dupe.Key.DisplayOrder}",
            location: $"flow:{flow.MajorCode}.slot[{dupe.Key.Semester},{dupe.Key.DisplayOrder}]");

    // Sum DegreeClass slots from Course.Credits + Elective* slots from slot.RequiredCredits.
    var coursesByClassId = catalog.ToDictionary(c => c.ClassId);
    decimal sum = 0m;
    foreach (var slot in flow.Slots)
    {
        if (slot.SlotType == SlotType.DegreeClass && slot.ClassId is not null
            && coursesByClassId.TryGetValue(slot.ClassId, out var course))
        {
            sum += course.Credits;
        }
        else if (slot.SlotType != SlotType.DegreeClass)
        {
            sum += slot.RequiredCredits ?? 0m;
        }
    }
    if (sum != flow.TotalCreditsRequired)
        report.Add(SeedIssueKind.CreditTotalMismatch, IssueSeverity.Warning,
            $"Sum of slot credits ({sum}) does not match totalCreditsRequired ({flow.TotalCreditsRequired})",
            location: $"flow:{flow.MajorCode}");

    return report;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~SeedValidatorTests"
```

Expected: `Passed! - Failed: 0, Passed: 11, Skipped: 0`

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Services/Validation/SeedValidator.cs tests/ISUCourseManager.Services.Tests/SeedValidatorTests.cs
git commit -m "feat(validation): flow integrity checks (orphan refs, dup positions, recommendedPairing, credit totals)"
```

---

## Task 14: End-to-end test against the actual seed files

**Files:**
- Create: `tests/ISUCourseManager.Services.Tests/ActualSeedFileTests.cs`

This test runs against the real `Data/cybe_flowchart.json` and `Documentation/seed-templates/isu-catalog.json`. It's expected to **fail meaningfully** the first time, surfacing every real bug in the seed data — that's the test's purpose. After this task lands, the user uses the failure list to do their refinement pass.

- [ ] **Step 1: Write the test**

Create `tests/ISUCourseManager.Services.Tests/ActualSeedFileTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Seed;
using ISUCourseManager.Services.Tests.Helpers;
using ISUCourseManager.Services.Validation;
using Xunit.Abstractions;

namespace ISUCourseManager.Services.Tests;

public class ActualSeedFileTests
{
    private readonly ITestOutputHelper _output;
    public ActualSeedFileTests(ITestOutputHelper output) => _output = output;

    [Fact]
    public void Catalog_passes_validation_with_no_errors()
    {
        var catalog = SeedLoader.LoadCatalog(RepoPaths.CatalogJsonPath);
        var report = SeedValidator.ValidateCatalog(catalog);

        _output.WriteLine(report.ToString());

        report.IsValid.Should().BeTrue("the catalog must have no errors. Warnings (e.g., unparsed prereqs) are OK.");
    }

    [Fact]
    public void Flow_passes_validation_against_catalog_with_no_errors()
    {
        var catalog = SeedLoader.LoadCatalog(RepoPaths.CatalogJsonPath);
        var flow = SeedLoader.LoadFlow(RepoPaths.CybeFlowJsonPath);
        var report = SeedValidator.ValidateFlow(flow, catalog);

        _output.WriteLine(report.ToString());

        report.IsValid.Should().BeTrue("the flow must reference only catalog-resident courses and have no duplicates");
    }

    [Fact]
    public void Combined_seed_data_warning_summary()
    {
        // This test always passes; it just dumps the warning summary so we can see
        // what the seed data still needs (e.g., unparsed prereqs, credit deltas).
        var catalog = SeedLoader.LoadCatalog(RepoPaths.CatalogJsonPath);
        var flow = SeedLoader.LoadFlow(RepoPaths.CybeFlowJsonPath);
        var catalogReport = SeedValidator.ValidateCatalog(catalog);
        var flowReport = SeedValidator.ValidateFlow(flow, catalog);

        _output.WriteLine("=== CATALOG REPORT ===");
        _output.WriteLine(catalogReport.ToString());
        _output.WriteLine("");
        _output.WriteLine("=== FLOW REPORT ===");
        _output.WriteLine(flowReport.ToString());
    }
}
```

- [ ] **Step 2: Run the actual-seed tests**

```
dotnet test tests/ISUCourseManager.Services.Tests/ISUCourseManager.Services.Tests.csproj --filter "FullyQualifiedName~ActualSeedFileTests" --logger "console;verbosity=detailed"
```

**Expected outcome (concrete):** `Catalog_passes_validation_with_no_errors` will **FAIL on first run** with multiple `OrphanCrossListing` and `OrphanPrereqReference` errors. This is the *expected and useful* outcome — the failure list is the artifact the user uses to drive catalog refinement.

The roughly-known issues you should expect to surface on first run (verified by inspection of the actual catalog):

1. **`OrphanCrossListing` errors** — the catalog has these cross-listing targets that aren't (yet) themselves catalog entries:
   - `CYBE-2300 → CPRE-2300` (and similarly CYBE-2310 → CPRE-2310, CYBE-2340 → CPRE-2340, CYBE-3310 → CPRE-3310, CYBE-4400 → CPRE-4400)
   - `CPRE-1660 → EE-1660`, `CPRE-4940 → EE-4940`
   - `CPRE-4910 → EE-4910, SE-4910, CYBE-4910` (multi-target)
   - `CPRE-4920 → EE-4920, SE-4920, CYBE-4920`
   - `CPRE-4360 → CYBE-4360`, `CPRE-4370 → CYBE-4370`
   - `COMS-3090 → SE-3090`
   - `CPRE-4300 → CYBSC-4300`

   **Root cause:** the catalog was scraped one-direction-only. To fix, add the cross-listed peer courses (CPRE-2300, EE-1660, etc.) as full catalog entries with the inverse cross-listing, OR change the validator to treat one-sided cross-listings as warnings rather than errors. **Recommend adding the peers** — the cascade engine in a future plan needs them anyway to evaluate equivalent enrollments (AC-19, AC-20).

2. **`OrphanPrereqReference` errors** — structured (non-`_unparsed`) prereq trees reference these classes that aren't in the catalog:
   - `MATH-3170` references `MATH-2010`, `COMS-2300`
   - `STAT-3030` references `MATH-1660` (✓ this one IS in catalog — verify)
   - Various others

   **Fix:** add the missing course entries OR mark them out-of-scope by widening the catalog.

3. **`UnparsedPrereqString` warnings** (~12 expected, **not errors**) — the auto-extractor flagged these for human review:
   `CHEM-1670, COMS-2270, COMS-3090, COMS-3110, CPRE-1850, CPRE-4300, CPRE-4910, CYBE-4400, MATH-3040, MATH-3140, PHYS-2310, PHYS-2310L`
   
   No action required for this plan — these are flagged for human conversion in a follow-up data-cleanup task.

**Do not "fix" these tests by relaxing the assertions** — fix the data they're flagging. The intent of `Catalog_passes_validation_with_no_errors` is to be the gate that proves the catalog is consistent. Once you've added the missing peer courses and structured prereqs, this test should turn green; the warning-emitting summary test will still print the 12 unparsed strings until those are also addressed.

**Estimated cleanup work:** ~30 minutes to add the ~10 missing cross-listed peer courses (most fields can be lifted directly from their CYBE/CPRE counterparts).

- [ ] **Step 3: Commit**

```
git add tests/ISUCourseManager.Services.Tests/ActualSeedFileTests.cs
git commit -m "test: end-to-end validation against actual seed files"
```

---

## Task 15: Run the full suite and review

**Files:** none modified.

- [ ] **Step 1: Run every test in the solution**

```
dotnet test ISUCourseManager.sln --logger "console;verbosity=normal"
```

**Expected:** All `PrereqExpressionConverterTests`, `SeedLoaderTests`, and `SeedValidatorTests` pass. The `ActualSeedFileTests` may have failures — those are real findings about the seed data, not regressions.

- [ ] **Step 2: Review the actual-seed-file findings**

Look at the test output from `ActualSeedFileTests`. Each error in the `Combined_seed_data_warning_summary` output is something the user needs to either:
- **Fix in the seed data** (most likely): correct the typo, add the missing course, fix the cross-listing.
- **Document as a known limitation** (rare): write a note in the seed-templates README explaining why the issue exists.

For the 12 known `_unparsed` prereq warnings (per spec data-model invariants (§4) and the README under `Documentation/seed-templates/`), no action needed yet — those are flagged for human conversion in a future plan.

- [ ] **Step 3: Final commit if anything was tweaked**

If you fixed any real issues in the seed data while reviewing:

```
git add Data/cybe_flowchart.json Documentation/seed-templates/isu-catalog.json
git commit -m "fix(seed): address validator findings"
```

---

## Done

When all tasks are complete you'll have:

- A working .NET 8 solution scaffold (`Api`, `Services`, `Data`, plus the test project)
- All entity POCOs from spec §4
- A working `SeedLoader` that parses both JSON files into typed in-memory objects
- A `SeedValidator` that runs every integrity check from spec data-model invariants (§4) and the README under `Documentation/seed-templates/` ("Validation the importer will run") plus the catalog checks
- A passing test suite that proves the validator works on synthetic cases
- A failing/passing end-to-end test that validates the actual seed files in the repo
- Frequent commits with clear messages — clean history to build on

Next plan in the queue (not part of this one): EF Core + SQLite persistence, then the cascade engine, then the API, then the React frontend. See spec data-model invariants (§4) and the README under `Documentation/seed-templates/` for the open-items list.
