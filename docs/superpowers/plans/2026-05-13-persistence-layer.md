# Persistence Layer Implementation Plan (Plan #2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EF Core 8 + SQLite persistence to the .NET solution, configure all entities (catalog + flow + student tiers) with Fluent API, generate the initial migration, refactor the seed loader to persist into the database, implement core repositories, and verify with integration tests.

**Architecture:** EF Core 8 against SQLite (POC) — same `DbContext` will target SQL Server in production via provider swap. JSON columns hold the polymorphic prereq trees, cross-listings, term offerings, and recommended pairings (matches the seed-file shape). Repository interfaces live in `Data/Repositories/`; EF implementations live alongside; Services project will consume these interfaces in plan #3 (cascade engine). String semantic FKs (`Course.ClassId` as alternate key) keep `StudentCourse.CourseId` and `FlowchartSlot.ClassId` stable across catalog re-seeds, per system spec decision 22.

**Tech Stack:** .NET 8, EF Core 8 (Microsoft.EntityFrameworkCore.Sqlite), xUnit, FluentAssertions, System.Text.Json. Cross-platform; runs on Windows/macOS/Linux without modification.

**Spec reference:** `docs/superpowers/specs/2026-05-12-isu-course-manager-design.md` §3 (architecture), §4 (domain model with all three tiers), decisions 22 (string semantic FKs), 28 (AcademicTerm), 31 (Term vs Season), 33 (CascadeOptions defaults).

**Depends on:** Plan #1 (`2026-05-12-seed-validation-and-loader.md`) executed — entity POCOs, JSON DTOs, `SeedLoader.LoadCatalog`/`LoadFlow`, `PrereqExpressionConverter`, and `AcademicTerm` helper must exist.

**Out of scope (later plans):** Cascade engine (plan #3), API controllers (plan #4), AI service (plan #5), React frontend (plan #6). EF migrations targeting SQL Server (provider swap in deployment plan, later).

---

## File structure

What this plan creates or modifies:

```
src/ISUCourseManager.Data/
├── ApplicationDbContext.cs                   (NEW — DbSet<T> for each entity)
├── Configurations/                           (NEW directory)
│   ├── CourseConfiguration.cs                EF Fluent API: keys, JSON columns,
│   │                                          unique index on ClassId, etc.
│   ├── DegreeFlowConfiguration.cs            Notes JSON, Slots collection nav
│   ├── FlowchartSlotConfiguration.cs         RecommendedPairing JSON,
│   │                                          ClassId FK to Course.ClassId
│   ├── StudentConfiguration.cs               Courses + DegreeFlows collection nav
│   ├── StudentCourseConfiguration.cs         CourseId FK to Course.ClassId,
│   │                                          AcademicTerm int, Status enum
│   └── StudentDegreeFlowConfiguration.cs     Status enum, FK to DegreeFlow
├── Repositories/                             (NEW directory)
│   ├── ICourseRepository.cs                  read-mostly (catalog)
│   ├── CourseRepository.cs                   EF implementation
│   ├── IDegreeFlowRepository.cs              read-mostly (flows)
│   ├── DegreeFlowRepository.cs
│   ├── IStudentRepository.cs                 read + mutate (students)
│   └── StudentRepository.cs
├── Migrations/                               (generated — `dotnet ef migrations add`)
│   ├── 20260513XXXXXX_InitialCreate.cs
│   ├── 20260513XXXXXX_InitialCreate.Designer.cs
│   └── ApplicationDbContextModelSnapshot.cs
├── Seed/
│   ├── SeedLoader.cs                         (existing from plan #1; no changes)
│   ├── DbSeedRunner.cs                       (NEW — persists Catalog + DegreeFlow into DB)
│   └── (existing seed files + JSON DTOs)

src/ISUCourseManager.Api/
├── Program.cs                                (MODIFY — register DbContext, run seed on startup)
└── appsettings.json                          (MODIFY — connection string)
└── appsettings.Development.json              (NEW — dev DB path)

tests/
└── ISUCourseManager.Data.Tests/              (NEW test project)
    ├── ISUCourseManager.Data.Tests.csproj
    ├── Helpers/
    │   └── InMemoryDb.cs                     SQLite-in-memory DbContext factory
    ├── ApplicationDbContextTests.cs          schema sanity: every entity has a table
    ├── CourseConfigurationTests.cs           round-trip Course with all JSON columns
    ├── DegreeFlowConfigurationTests.cs       round-trip DegreeFlow + slots
    ├── StudentConfigurationTests.cs          round-trip Student + courses + flows
    ├── CourseRepositoryTests.cs              GetByClassId, ListByDepartment, etc.
    ├── DegreeFlowRepositoryTests.cs          GetById, ListAll
    ├── StudentRepositoryTests.cs             Get/AddCourse/UpdateCourse/RemoveCourse
    └── DbSeedRunnerTests.cs                  idempotent seed; loads from JSON; persists
```

---

## Task 1: Add EF Core packages to the Data project

**Files:**
- Modify: `src/ISUCourseManager.Data/ISUCourseManager.Data.csproj`

- [ ] **Step 1: Verify .NET 8 SDK is still installed**

Run: `dotnet --version`
Expected: any 8.x.x output.

- [ ] **Step 2: Add EF Core packages to the Data project**

From repository root:
```
dotnet add src/ISUCourseManager.Data/ISUCourseManager.Data.csproj package Microsoft.EntityFrameworkCore --version 8.0.10
dotnet add src/ISUCourseManager.Data/ISUCourseManager.Data.csproj package Microsoft.EntityFrameworkCore.Sqlite --version 8.0.10
dotnet add src/ISUCourseManager.Data/ISUCourseManager.Data.csproj package Microsoft.EntityFrameworkCore.Design --version 8.0.10
```

Each should print `info : PackageReference for package '...' version '8.0.10' added to file '...'`.

- [ ] **Step 3: Install the dotnet-ef CLI tool globally (if not already)**

Run: `dotnet tool list -g | grep dotnet-ef`

If empty, install:
```
dotnet tool install --global dotnet-ef --version 8.0.10
```

Expected: `Tool 'dotnet-ef' (version '8.0.10') was successfully installed.`

If already installed, verify version is 8.x:
```
dotnet ef --version
```

- [ ] **Step 4: Build to verify the project still compiles**

```
dotnet build src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
```

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
git commit -m "build(data): add EF Core 8 SQLite packages"
```

---

## Task 2: Create the test project

**Files:**
- Create: `tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj`

- [ ] **Step 1: Generate the test project**

```
dotnet new xunit --framework net8.0 --output tests/ISUCourseManager.Data.Tests --name ISUCourseManager.Data.Tests
rm tests/ISUCourseManager.Data.Tests/UnitTest1.cs
```

(Windows users: use `del` or `Remove-Item` instead of `rm`.)

- [ ] **Step 2: Add references and packages**

```
dotnet add tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj reference src/ISUCourseManager.Data/ISUCourseManager.Data.csproj
dotnet add tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj package FluentAssertions
```

- [ ] **Step 3: Add the project to the solution**

```
dotnet sln ISUCourseManager.sln add tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj
```

- [ ] **Step 4: Enable Nullable + ImplicitUsings on the test project**

Edit `tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj` so its `<PropertyGroup>` reads:

```xml
<PropertyGroup>
  <TargetFramework>net8.0</TargetFramework>
  <ImplicitUsings>enable</ImplicitUsings>
  <Nullable>enable</Nullable>
  <IsPackable>false</IsPackable>
  <IsTestProject>true</IsTestProject>
</PropertyGroup>
```

- [ ] **Step 5: Build the solution to verify**

```
dotnet build ISUCourseManager.sln
```

Expected: `Build succeeded.` All projects compile, including the new empty test project.

- [ ] **Step 6: Commit**

```
git add tests/ISUCourseManager.Data.Tests/ ISUCourseManager.sln
git commit -m "test(data): add ISUCourseManager.Data.Tests project"
```

---

## Task 3: InMemoryDb test helper

**Files:**
- Create: `tests/ISUCourseManager.Data.Tests/Helpers/InMemoryDb.cs`

- [ ] **Step 1: Write the helper**

Create `tests/ISUCourseManager.Data.Tests/Helpers/InMemoryDb.cs`:

```csharp
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ISUCourseManager.Data;

namespace ISUCourseManager.Data.Tests.Helpers;

/// <summary>
/// Spin up an isolated SQLite in-memory ApplicationDbContext for a single test.
/// We use real SQLite (not the EF InMemory provider) so FK constraints, unique
/// indexes, and JSON column behavior all match production.
///
/// Usage:
///   using var db = InMemoryDb.Create();
///   db.Courses.Add(new Course { ... });
///   db.SaveChanges();
///   ...
/// </summary>
internal static class InMemoryDb
{
    public static ApplicationDbContext Create()
    {
        // Connection must stay OPEN for the lifetime of the in-memory DB; closing it
        // disposes the database.
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(connection)
            .Options;

        var ctx = new ApplicationDbContext(options);
        ctx.Database.EnsureCreated();   // applies the schema from the model
        return ctx;
    }
}
```

`ApplicationDbContext` doesn't exist yet — that's fine; the test project's reference to `ISUCourseManager.Data` will resolve it once Task 4 lands.

- [ ] **Step 2: Build to confirm the helper compiles after Task 4**

(Skip the build now; this file references a type that comes in Task 4. Defer the verifying build to Task 4 Step 6.)

- [ ] **Step 3: Commit**

```
git add tests/ISUCourseManager.Data.Tests/Helpers/
git commit -m "test(data): InMemoryDb helper using SQLite in-memory mode"
```

---

## Task 4: ApplicationDbContext skeleton with DbSet<T> per entity

**Files:**
- Create: `src/ISUCourseManager.Data/ApplicationDbContext.cs`
- Test: `tests/ISUCourseManager.Data.Tests/ApplicationDbContextTests.cs`

- [ ] **Step 1: Write failing schema sanity tests**

Create `tests/ISUCourseManager.Data.Tests/ApplicationDbContextTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class ApplicationDbContextTests
{
    [Fact]
    public void Schema_is_created_with_all_six_entity_tables()
    {
        using var db = InMemoryDb.Create();

        // Tables exist if these queries don't throw
        Action courses        = () => db.Courses.ToList();
        Action degreeFlows    = () => db.DegreeFlows.ToList();
        Action flowchartSlots = () => db.FlowchartSlots.ToList();
        Action students       = () => db.Students.ToList();
        Action studentCourses = () => db.StudentCourses.ToList();
        Action studentFlows   = () => db.StudentDegreeFlows.ToList();

        courses.Should().NotThrow();
        degreeFlows.Should().NotThrow();
        flowchartSlots.Should().NotThrow();
        students.Should().NotThrow();
        studentCourses.Should().NotThrow();
        studentFlows.Should().NotThrow();
    }

    [Fact]
    public void EnsureCreated_is_idempotent()
    {
        using var db = InMemoryDb.Create();
        var first = db.Database.EnsureCreated();
        var second = db.Database.EnsureCreated();
        first.Should().BeFalse("EnsureCreated returns false when schema already existed (we created it in InMemoryDb.Create)");
        second.Should().BeFalse();
    }
}
```

- [ ] **Step 2: Run to verify failure (compile error — ApplicationDbContext doesn't exist)**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~ApplicationDbContextTests"
```

Expected: build error referring to missing `ApplicationDbContext` and its DbSets.

- [ ] **Step 3: Create the DbContext**

Create `src/ISUCourseManager.Data/ApplicationDbContext.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;

namespace ISUCourseManager.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Course> Courses              => Set<Course>();
    public DbSet<DegreeFlow> DegreeFlows      => Set<DegreeFlow>();
    public DbSet<FlowchartSlot> FlowchartSlots => Set<FlowchartSlot>();
    public DbSet<Student> Students            => Set<Student>();
    public DbSet<StudentCourse> StudentCourses => Set<StudentCourse>();
    public DbSet<StudentDegreeFlow> StudentDegreeFlows => Set<StudentDegreeFlow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configurations applied per entity in their *Configuration classes
        // (added in Tasks 5-7). For now, EF will use convention-based mapping.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~ApplicationDbContextTests"
```

Expected: `Passed! - Failed: 0, Passed: 2, Skipped: 0`

If a test fails because of a missing convention-based map (e.g., EF doesn't know how to handle the `PrereqExpression?` field on Course), don't worry — Tasks 5-7 add explicit configurations. For Task 4, `EnsureCreated` may emit warnings about types it can't map; if any test fails, comment out the offending DbSets temporarily and add them back as their configurations land.

Note: convention-based mapping likely WILL fail on `Course.Prereqs` (abstract `PrereqExpression`), `Course.CrossListedAs` (List<string>), and `Course.TypicallyOffered` (List<Term>). If that happens, add temporary `[NotMapped]` attributes on those fields in the entity classes and remove them in Task 5 once the configurations cover them. Document this temporary state in the commit message.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Data/ApplicationDbContext.cs tests/ISUCourseManager.Data.Tests/ApplicationDbContextTests.cs
git commit -m "feat(data): ApplicationDbContext skeleton with DbSets for all entities"
```

---

## Task 5: CourseConfiguration — JSON columns, alternate key on ClassId

**Files:**
- Create: `src/ISUCourseManager.Data/Configurations/CourseConfiguration.cs`
- Test: `tests/ISUCourseManager.Data.Tests/CourseConfigurationTests.cs`

- [ ] **Step 1: Write the failing round-trip tests**

Create `tests/ISUCourseManager.Data.Tests/CourseConfigurationTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class CourseConfigurationTests
{
    [Fact]
    public void Course_round_trips_with_basic_fields()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course
        {
            ClassId = "MATH-1650",
            Code = "Math 1650",
            Name = "Calc I",
            OfficialName = "Calculus I",
            Credits = 4m,
            Department = "Math",
        });
        db.SaveChanges();

        // Re-read from a fresh context to make sure it round-trips through SQL
        var reloaded = db.Courses.AsNoTracking().Single(c => c.ClassId == "MATH-1650");
        reloaded.Code.Should().Be("Math 1650");
        reloaded.OfficialName.Should().Be("Calculus I");
        reloaded.Credits.Should().Be(4m);
        reloaded.Department.Should().Be("Math");
    }

    [Fact]
    public void Course_ClassId_must_be_unique()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course
        {
            ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I",
            Credits = 4m, Department = "Math",
        });
        db.Courses.Add(new Course
        {
            ClassId = "MATH-1650", Code = "Math 1650 (dup)", Name = "Calc I (dup)",
            Credits = 4m, Department = "Math",
        });

        Action act = () => db.SaveChanges();
        act.Should().Throw<DbUpdateException>("ClassId has a unique index");
    }

    [Fact]
    public void Course_Prereqs_round_trip_as_JSON_polymorphic_tree()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course
        {
            ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II",
            Credits = 4m, Department = "Math",
            Prereqs = new PrereqCourse { ClassId = "MATH-1650", MinGrade = "C-" },
        });
        db.SaveChanges();

        var reloaded = db.Courses.AsNoTracking().Single(c => c.ClassId == "MATH-1660");
        reloaded.Prereqs.Should().BeOfType<PrereqCourse>();
        var prereq = (PrereqCourse)reloaded.Prereqs!;
        prereq.ClassId.Should().Be("MATH-1650");
        prereq.MinGrade.Should().Be("C-");
    }

    [Fact]
    public void Course_CrossListedAs_round_trips_as_JSON_string_list()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course
        {
            ClassId = "CYBE-2300", Code = "Cyb E 2300", Name = "Cyber Sec Fund",
            Credits = 3m, Department = "CybE",
            CrossListedAs = new List<string> { "CPRE-2300" },
        });
        db.SaveChanges();

        var reloaded = db.Courses.AsNoTracking().Single(c => c.ClassId == "CYBE-2300");
        reloaded.CrossListedAs.Should().Equal("CPRE-2300");
    }

    [Fact]
    public void Course_TypicallyOffered_round_trips_as_JSON_enum_list()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course
        {
            ClassId = "COMS-3110", Code = "Com S 3110", Name = "Algos",
            Credits = 3m, Department = "ComS",
            TypicallyOffered = new List<Term> { Term.Fall },
        });
        db.SaveChanges();

        var reloaded = db.Courses.AsNoTracking().Single(c => c.ClassId == "COMS-3110");
        reloaded.TypicallyOffered.Should().Equal(Term.Fall);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~CourseConfigurationTests"
```

Expected: at least the JSON-column tests fail; the basic round-trip may pass under convention-based mapping if `[NotMapped]` was applied in Task 4.

- [ ] **Step 3: Create the configuration**

Create `src/ISUCourseManager.Data/Configurations/CourseConfiguration.cs`:

```csharp
using System.Text.Json;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ISUCourseManager.Data.Configurations;

public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> builder)
    {
        builder.ToTable("courses");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ClassId).IsRequired().HasMaxLength(32);
        builder.HasAlternateKey(c => c.ClassId);    // unique + usable as FK target
        builder.HasIndex(c => c.ClassId).IsUnique();

        builder.Property(c => c.Code).IsRequired().HasMaxLength(64);
        builder.Property(c => c.Name).IsRequired().HasMaxLength(64);
        builder.Property(c => c.OfficialName).HasMaxLength(255);
        builder.Property(c => c.Department).IsRequired().HasMaxLength(16);
        builder.Property(c => c.Credits).HasPrecision(5, 2);
        builder.Property(c => c.CreditNote).HasMaxLength(32);

        // Polymorphic prereq tree → JSON column. Reuses the converter from plan #1.
        var prereqOpts = new JsonSerializerOptions
        {
            Converters = { new PrereqExpressionConverter() },
        };

        var prereqConverter = new ValueConverter<PrereqExpression?, string?>(
            v => v == null ? null : JsonSerializer.Serialize(v, prereqOpts),
            v => v == null ? null : JsonSerializer.Deserialize<PrereqExpression>(v, prereqOpts));

        builder.Property(c => c.Prereqs).HasConversion(prereqConverter).HasColumnType("TEXT");
        builder.Property(c => c.Coreqs).HasConversion(prereqConverter).HasColumnType("TEXT");

        // Simple string list → JSON column
        var stringListConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new());

        var stringListComparer = new ValueComparer<List<string>>(
            (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
            v => v == null ? 0 : v.Aggregate(0, (acc, s) => HashCode.Combine(acc, s.GetHashCode())),
            v => v == null ? new() : v.ToList());

        builder.Property(c => c.CrossListedAs)
            .HasConversion(stringListConverter)
            .Metadata.SetValueComparer(stringListComparer);

        // List<Term> → JSON column (serializes as ["Fall","Spring"])
        var termListConverter = new ValueConverter<List<Term>, string>(
            v => JsonSerializer.Serialize(v.Select(t => t.ToString()).ToList(), (JsonSerializerOptions?)null),
            v => (JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new())
                    .Select(s => Enum.Parse<Term>(s)).ToList());

        var termListComparer = new ValueComparer<List<Term>>(
            (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
            v => v == null ? 0 : v.Aggregate(0, (acc, t) => HashCode.Combine(acc, t.GetHashCode())),
            v => v == null ? new() : v.ToList());

        builder.Property(c => c.TypicallyOffered)
            .HasConversion(termListConverter)
            .Metadata.SetValueComparer(termListComparer);

        builder.Property(c => c.IsActive).HasDefaultValue(true);
    }
}
```

If you added `[NotMapped]` attributes to `Course` fields in Task 4, **remove them now** so EF picks up the conversions defined here.

- [ ] **Step 4: Add the missing using for ValueConverter and ValueComparer**

The configuration file references `ValueConverter` and `ValueComparer` — these live in `Microsoft.EntityFrameworkCore.Storage.ValueConversion`. Add:

```csharp
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.EntityFrameworkCore.ChangeTracking;
```

at the top of the configuration file.

- [ ] **Step 5: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~CourseConfigurationTests"
```

Expected: `Passed! - Failed: 0, Passed: 5, Skipped: 0`

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Data/Configurations/CourseConfiguration.cs src/ISUCourseManager.Data/Entity/Course.cs tests/ISUCourseManager.Data.Tests/CourseConfigurationTests.cs
git commit -m "feat(data): CourseConfiguration — JSON columns + alt-key on ClassId"
```

---

## Task 6: DegreeFlow + FlowchartSlot configurations

**Files:**
- Create: `src/ISUCourseManager.Data/Configurations/DegreeFlowConfiguration.cs`
- Create: `src/ISUCourseManager.Data/Configurations/FlowchartSlotConfiguration.cs`
- Test: `tests/ISUCourseManager.Data.Tests/DegreeFlowConfigurationTests.cs`

- [ ] **Step 1: Write the failing round-trip tests**

Create `tests/ISUCourseManager.Data.Tests/DegreeFlowConfigurationTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class DegreeFlowConfigurationTests
{
    [Fact]
    public void DegreeFlow_round_trips_with_notes()
    {
        using var db = InMemoryDb.Create();
        db.DegreeFlows.Add(new DegreeFlow
        {
            MajorCode = "CYBE",
            MajorName = "Cyber Security Engineering",
            CatalogYear = "2025-26",
            TotalCreditsRequired = 125,
            Notes = new List<string> { "guide only", "check catalog" },
        });
        db.SaveChanges();

        var reloaded = db.DegreeFlows.AsNoTracking().Single(f => f.MajorCode == "CYBE");
        reloaded.MajorName.Should().Be("Cyber Security Engineering");
        reloaded.CatalogYear.Should().Be("2025-26");
        reloaded.TotalCreditsRequired.Should().Be(125);
        reloaded.Notes.Should().Equal("guide only", "check catalog");
    }

    [Fact]
    public void FlowchartSlot_DegreeClass_round_trips_with_classId_FK()
    {
        using var db = InMemoryDb.Create();
        // Need a Course for the FK to resolve
        db.Courses.Add(new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" });
        var flow = new DegreeFlow
        {
            MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 125,
        };
        db.DegreeFlows.Add(flow);
        db.SaveChanges();

        db.FlowchartSlots.Add(new FlowchartSlot
        {
            DegreeFlowId = flow.Id,
            Semester = 1, DisplayOrder = 1,
            SlotType = SlotType.DegreeClass,
            ClassId = "MATH-1650",
            DisplayName = "Calc I",
            MinGrade = "C-",
        });
        db.SaveChanges();

        var reloaded = db.FlowchartSlots.AsNoTracking().Single();
        reloaded.SlotType.Should().Be(SlotType.DegreeClass);
        reloaded.ClassId.Should().Be("MATH-1650");
        reloaded.RequiredCredits.Should().BeNull();
        reloaded.MinGrade.Should().Be("C-");
    }

    [Fact]
    public void FlowchartSlot_RecommendedPairing_round_trips_as_JSON_string_list()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" });
        db.Courses.Add(new Course { ClassId = "CPRE-1850", Code = "CprE 1850", Name = "Prob Solv", Credits = 3m, Department = "CprE" });
        var flow = new DegreeFlow
        {
            MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 7,
        };
        db.DegreeFlows.Add(flow);
        db.SaveChanges();

        db.FlowchartSlots.Add(new FlowchartSlot
        {
            DegreeFlowId = flow.Id, Semester = 1, DisplayOrder = 3,
            SlotType = SlotType.DegreeClass, ClassId = "CPRE-1850",
            RecommendedPairing = new List<string> { "MATH-1650" },
        });
        db.SaveChanges();

        var reloaded = db.FlowchartSlots.AsNoTracking().Single(s => s.ClassId == "CPRE-1850");
        reloaded.RecommendedPairing.Should().Equal("MATH-1650");
    }

    [Fact]
    public void FlowchartSlot_Elective_round_trips_with_RequiredCredits_and_no_classId()
    {
        using var db = InMemoryDb.Create();
        var flow = new DegreeFlow
        {
            MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 3,
        };
        db.DegreeFlows.Add(flow);
        db.SaveChanges();

        db.FlowchartSlots.Add(new FlowchartSlot
        {
            DegreeFlowId = flow.Id, Semester = 8, DisplayOrder = 2,
            SlotType = SlotType.ElectiveTech,
            RequiredCredits = 3m,
        });
        db.SaveChanges();

        var reloaded = db.FlowchartSlots.AsNoTracking().Single(s => s.SlotType == SlotType.ElectiveTech);
        reloaded.ClassId.Should().BeNull();
        reloaded.RequiredCredits.Should().Be(3m);
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~DegreeFlowConfigurationTests"
```

Expected: build error — configurations don't exist.

- [ ] **Step 3: Create DegreeFlowConfiguration**

Create `src/ISUCourseManager.Data/Configurations/DegreeFlowConfiguration.cs`:

```csharp
using System.Text.Json;
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ISUCourseManager.Data.Configurations;

public class DegreeFlowConfiguration : IEntityTypeConfiguration<DegreeFlow>
{
    public void Configure(EntityTypeBuilder<DegreeFlow> builder)
    {
        builder.ToTable("degree_flows");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.MajorCode).IsRequired().HasMaxLength(8);
        builder.Property(f => f.MajorName).IsRequired().HasMaxLength(128);
        builder.Property(f => f.CatalogYear).IsRequired().HasMaxLength(8);
        builder.Property(f => f.TotalCreditsRequired);

        // Composite uniqueness: one flow per (MajorCode, CatalogYear)
        builder.HasIndex(f => new { f.MajorCode, f.CatalogYear }).IsUnique();

        // Notes List<string> → JSON column
        var stringListConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new());
        var stringListComparer = new ValueComparer<List<string>>(
            (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
            v => v == null ? 0 : v.Aggregate(0, (acc, s) => HashCode.Combine(acc, s.GetHashCode())),
            v => v == null ? new() : v.ToList());

        builder.Property(f => f.Notes)
            .HasConversion(stringListConverter)
            .Metadata.SetValueComparer(stringListComparer);

        builder.HasMany(f => f.Slots)
            .WithOne()
            .HasForeignKey(s => s.DegreeFlowId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

- [ ] **Step 4: Create FlowchartSlotConfiguration**

Create `src/ISUCourseManager.Data/Configurations/FlowchartSlotConfiguration.cs`:

```csharp
using System.Text.Json;
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ISUCourseManager.Data.Configurations;

public class FlowchartSlotConfiguration : IEntityTypeConfiguration<FlowchartSlot>
{
    public void Configure(EntityTypeBuilder<FlowchartSlot> builder)
    {
        builder.ToTable("flowchart_slots");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Semester);
        builder.Property(s => s.SlotType).HasConversion<string>().HasMaxLength(32);
        builder.Property(s => s.ClassId).HasMaxLength(32);     // string semantic FK to Course.ClassId
        builder.Property(s => s.DisplayName).HasMaxLength(64);
        builder.Property(s => s.RequiredCredits).HasPrecision(5, 2);  // nullable
        builder.Property(s => s.CreditNote).HasMaxLength(32);
        builder.Property(s => s.MinGrade).HasMaxLength(8);
        builder.Property(s => s.ClassNote).HasMaxLength(64);
        builder.Property(s => s.DisplayOrder);

        // No physical FK to Course because semantic FK is on string ClassId,
        // not Course.Id (Guid surrogate). EF can express this via HasOne/HasPrincipalKey
        // but we avoid it for now to keep ClassId references stable across re-seeds —
        // catalog re-seed regenerates Course.Id but ClassId stays. Validation that
        // ClassId resolves is handled by SeedValidator (plan #1) at import time.

        // Composite uniqueness: one slot per (DegreeFlowId, Semester, DisplayOrder)
        builder.HasIndex(s => new { s.DegreeFlowId, s.Semester, s.DisplayOrder }).IsUnique();

        // RecommendedPairing List<string> → JSON column
        var stringListConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new());
        var stringListComparer = new ValueComparer<List<string>>(
            (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
            v => v == null ? 0 : v.Aggregate(0, (acc, s) => HashCode.Combine(acc, s.GetHashCode())),
            v => v == null ? new() : v.ToList());

        builder.Property(s => s.RecommendedPairing)
            .HasConversion(stringListConverter)
            .Metadata.SetValueComparer(stringListComparer);
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~DegreeFlowConfigurationTests"
```

Expected: `Passed! - Failed: 0, Passed: 4, Skipped: 0`

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Data/Configurations/DegreeFlowConfiguration.cs src/ISUCourseManager.Data/Configurations/FlowchartSlotConfiguration.cs tests/ISUCourseManager.Data.Tests/DegreeFlowConfigurationTests.cs
git commit -m "feat(data): DegreeFlow + FlowchartSlot configurations with JSON columns and unique indexes"
```

---

## Task 7: Student / StudentCourse / StudentDegreeFlow configurations

**Files:**
- Create: `src/ISUCourseManager.Data/Configurations/StudentConfiguration.cs`
- Create: `src/ISUCourseManager.Data/Configurations/StudentCourseConfiguration.cs`
- Create: `src/ISUCourseManager.Data/Configurations/StudentDegreeFlowConfiguration.cs`
- Test: `tests/ISUCourseManager.Data.Tests/StudentConfigurationTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Data.Tests/StudentConfigurationTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class StudentConfigurationTests
{
    [Fact]
    public void Student_round_trips_with_courses_and_flows()
    {
        using var db = InMemoryDb.Create();
        // Course + Flow exist (FK targets)
        db.Courses.Add(new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" });
        var flow = new DegreeFlow { MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 125 };
        db.DegreeFlows.Add(flow);
        db.SaveChanges();

        var student = new Student { DisplayName = "Luke" };
        db.Students.Add(student);
        db.SaveChanges();

        db.StudentCourses.Add(new StudentCourse
        {
            StudentId = student.Id,
            CourseId = "MATH-1650",
            AcademicTerm = 202602,
            Status = StudentCourseStatus.Completed,
            Grade = "A",
        });

        db.StudentDegreeFlows.Add(new StudentDegreeFlow
        {
            StudentId = student.Id,
            DegreeFlowId = flow.Id,
            Status = StudentDegreeFlowStatus.Active,
        });
        db.SaveChanges();

        var reloaded = db.Students
            .Include(s => s.Courses)
            .Include(s => s.DegreeFlows)
            .AsNoTracking()
            .Single();

        reloaded.DisplayName.Should().Be("Luke");
        reloaded.Courses.Should().HaveCount(1);
        reloaded.Courses[0].CourseId.Should().Be("MATH-1650");
        reloaded.Courses[0].Status.Should().Be(StudentCourseStatus.Completed);
        reloaded.Courses[0].Grade.Should().Be("A");
        reloaded.Courses[0].AcademicTerm.Should().Be(202602);
        reloaded.DegreeFlows.Should().HaveCount(1);
        reloaded.DegreeFlows[0].Status.Should().Be(StudentDegreeFlowStatus.Active);
    }

    [Fact]
    public void Student_can_have_multiple_Active_DegreeFlows_double_major()
    {
        using var db = InMemoryDb.Create();
        var cybe = new DegreeFlow { MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 125 };
        var cpre = new DegreeFlow { MajorCode = "CPRE", MajorName = "CprE", CatalogYear = "2025-26", TotalCreditsRequired = 123 };
        db.DegreeFlows.AddRange(cybe, cpre);
        var student = new Student { DisplayName = "Luke" };
        db.Students.Add(student);
        db.SaveChanges();

        db.StudentDegreeFlows.AddRange(
            new StudentDegreeFlow { StudentId = student.Id, DegreeFlowId = cybe.Id, Status = StudentDegreeFlowStatus.Active },
            new StudentDegreeFlow { StudentId = student.Id, DegreeFlowId = cpre.Id, Status = StudentDegreeFlowStatus.Active }
        );

        Action act = () => db.SaveChanges();
        act.Should().NotThrow("multiple Active rows are explicitly allowed for double majors per system spec decision 27");

        var actives = db.StudentDegreeFlows.AsNoTracking().Count(s => s.Status == StudentDegreeFlowStatus.Active);
        actives.Should().Be(2);
    }

    [Fact]
    public void StudentCourse_AcademicTerm_round_trips_as_int()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course { ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II", Credits = 4m, Department = "Math" });
        var student = new Student { DisplayName = "Test" };
        db.Students.Add(student);
        db.SaveChanges();

        db.StudentCourses.Add(new StudentCourse
        {
            StudentId = student.Id,
            CourseId = "MATH-1660",
            AcademicTerm = 202604,           // Spring 2026
            Status = StudentCourseStatus.Planned,
        });
        db.SaveChanges();

        var reloaded = db.StudentCourses.AsNoTracking().Single();
        reloaded.AcademicTerm.Should().Be(202604);
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~StudentConfigurationTests"
```

Expected: build error — configurations don't exist; tests use `Include()` which requires nav properties.

If `Include(s => s.Courses)` fails compilation, you may need to add nav properties to `Student.cs` per Task 6 of plan #1 (the entity definitions there list `public List<StudentCourse> Courses { get; init; } = new();` and `public List<StudentDegreeFlow> DegreeFlows { get; init; } = new();`). Verify these are present.

- [ ] **Step 3: Create StudentConfiguration**

Create `src/ISUCourseManager.Data/Configurations/StudentConfiguration.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ISUCourseManager.Data.Configurations;

public class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> builder)
    {
        builder.ToTable("students");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.DisplayName).IsRequired().HasMaxLength(128);

        builder.HasMany(s => s.Courses)
            .WithOne()
            .HasForeignKey(c => c.StudentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(s => s.DegreeFlows)
            .WithOne()
            .HasForeignKey(f => f.StudentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

- [ ] **Step 4: Create StudentCourseConfiguration**

Create `src/ISUCourseManager.Data/Configurations/StudentCourseConfiguration.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ISUCourseManager.Data.Configurations;

public class StudentCourseConfiguration : IEntityTypeConfiguration<StudentCourse>
{
    public void Configure(EntityTypeBuilder<StudentCourse> builder)
    {
        builder.ToTable("student_courses");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.StudentId);
        builder.Property(c => c.CourseId).IsRequired().HasMaxLength(32);   // semantic FK to Course.ClassId
        builder.Property(c => c.AcademicTerm);                              // YYYYSS int per spec §4
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(16);
        builder.Property(c => c.Grade).HasMaxLength(8);

        // Compound index lets us query "courses for student X in term Y" fast
        builder.HasIndex(c => new { c.StudentId, c.AcademicTerm });
    }
}
```

- [ ] **Step 5: Create StudentDegreeFlowConfiguration**

Create `src/ISUCourseManager.Data/Configurations/StudentDegreeFlowConfiguration.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ISUCourseManager.Data.Configurations;

public class StudentDegreeFlowConfiguration : IEntityTypeConfiguration<StudentDegreeFlow>
{
    public void Configure(EntityTypeBuilder<StudentDegreeFlow> builder)
    {
        builder.ToTable("student_degree_flows");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.StudentId);
        builder.Property(f => f.DegreeFlowId);
        builder.Property(f => f.Status).HasConversion<string>().HasMaxLength(16);
        builder.Property(f => f.CreatedAt);
        builder.Property(f => f.StatusChangedAt);

        // No uniqueness on (StudentId, Status=Active) — double majors allowed per spec decision 27
        builder.HasIndex(f => new { f.StudentId, f.Status });

        // Reference DegreeFlow (Guid surrogate FK is fine — flows are stable)
        builder.HasOne<DegreeFlow>()
            .WithMany()
            .HasForeignKey(f => f.DegreeFlowId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~StudentConfigurationTests"
```

Expected: `Passed! - Failed: 0, Passed: 3, Skipped: 0`

- [ ] **Step 7: Commit**

```
git add src/ISUCourseManager.Data/Configurations/Student* tests/ISUCourseManager.Data.Tests/StudentConfigurationTests.cs
git commit -m "feat(data): Student / StudentCourse / StudentDegreeFlow configurations"
```

---

## Task 8: Generate the initial EF migration

**Files:**
- Create: `src/ISUCourseManager.Data/Migrations/*` (auto-generated by `dotnet ef`)

The Data project is a class library, so EF needs a startup project to scaffold migrations. We'll temporarily use the Api project as the startup. (If the Api project lacks DbContext registration, add it temporarily — Task 11 makes it permanent.)

- [ ] **Step 1: Add a temporary DbContext registration in the Api project's Program.cs**

Edit `src/ISUCourseManager.Api/Program.cs` and add the following near the top of the builder configuration (after `var builder = WebApplication.CreateBuilder(args);`):

```csharp
using Microsoft.EntityFrameworkCore;
using ISUCourseManager.Data;

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite("Data Source=isucm-dev.db"));
```

This is a stand-in; Task 11 will make it driven by configuration.

- [ ] **Step 2: Add Microsoft.EntityFrameworkCore.Design to the Api project**

```
dotnet add src/ISUCourseManager.Api/ISUCourseManager.Api.csproj package Microsoft.EntityFrameworkCore.Design --version 8.0.10
```

- [ ] **Step 3: Build the solution to make sure everything compiles before generating the migration**

```
dotnet build ISUCourseManager.sln
```

Expected: `Build succeeded.`

- [ ] **Step 4: Generate the InitialCreate migration**

From the repo root:
```
dotnet ef migrations add InitialCreate \
  --project src/ISUCourseManager.Data/ISUCourseManager.Data.csproj \
  --startup-project src/ISUCourseManager.Api/ISUCourseManager.Api.csproj \
  --output-dir Migrations
```

Expected: `Done. To undo this action, use 'ef migrations remove'.`

This generates 3 files under `src/ISUCourseManager.Data/Migrations/`:
- `<timestamp>_InitialCreate.cs`
- `<timestamp>_InitialCreate.Designer.cs`
- `ApplicationDbContextModelSnapshot.cs`

Open the `<timestamp>_InitialCreate.cs` file. Verify it creates 6 tables: `courses`, `degree_flows`, `flowchart_slots`, `students`, `student_courses`, `student_degree_flows`. If any table is missing, a configuration is misregistered.

- [ ] **Step 5: Apply the migration to a real SQLite file as a smoke test**

```
dotnet ef database update \
  --project src/ISUCourseManager.Data/ISUCourseManager.Data.csproj \
  --startup-project src/ISUCourseManager.Api/ISUCourseManager.Api.csproj
```

Expected: `Applying migration 'InitialCreate'... Done.`

A file `src/ISUCourseManager.Api/isucm-dev.db` was created. Inspect with sqlite3:

```
sqlite3 src/ISUCourseManager.Api/isucm-dev.db ".tables"
```

Expected output:
```
__EFMigrationsHistory  flowchart_slots        student_degree_flows
courses                student_courses        students
degree_flows
```

(7 entries — 6 entity tables + the migrations history table.)

- [ ] **Step 6: Add the dev DB file to .gitignore**

Append to `.gitignore`:
```
# Local dev SQLite databases
*.db
*.db-journal
*.db-wal
*.db-shm
```

- [ ] **Step 7: Run the data tests one more time to ensure migration didn't break anything**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```
git add src/ISUCourseManager.Data/Migrations/ src/ISUCourseManager.Api/Program.cs src/ISUCourseManager.Api/ISUCourseManager.Api.csproj .gitignore
git commit -m "feat(data): generate InitialCreate EF migration; verify against SQLite"
```

---

## Task 9: ICourseRepository + CourseRepository

**Files:**
- Create: `src/ISUCourseManager.Data/Repositories/ICourseRepository.cs`
- Create: `src/ISUCourseManager.Data/Repositories/CourseRepository.cs`
- Test: `tests/ISUCourseManager.Data.Tests/CourseRepositoryTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Data.Tests/CourseRepositoryTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Repositories;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class CourseRepositoryTests
{
    [Fact]
    public async Task GetByClassId_returns_course_when_present()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" });
        await db.SaveChangesAsync();

        var repo = new CourseRepository(db);
        var c = await repo.GetByClassIdAsync("MATH-1650");

        c.Should().NotBeNull();
        c!.Code.Should().Be("Math 1650");
    }

    [Fact]
    public async Task GetByClassId_returns_null_when_absent()
    {
        using var db = InMemoryDb.Create();
        var repo = new CourseRepository(db);
        var c = await repo.GetByClassIdAsync("PHANTOM-9999");
        c.Should().BeNull();
    }

    [Fact]
    public async Task ListAll_returns_every_course()
    {
        using var db = InMemoryDb.Create();
        db.Courses.AddRange(
            new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" },
            new Course { ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II", Credits = 4m, Department = "Math" },
            new Course { ClassId = "CPRE-1850", Code = "CprE 1850", Name = "Prob Solv", Credits = 3m, Department = "CprE" });
        await db.SaveChangesAsync();

        var repo = new CourseRepository(db);
        var all = await repo.ListAllAsync();

        all.Should().HaveCount(3);
        all.Select(c => c.ClassId).Should().BeEquivalentTo(new[] { "MATH-1650", "MATH-1660", "CPRE-1850" });
    }

    [Fact]
    public async Task ListByDepartment_filters()
    {
        using var db = InMemoryDb.Create();
        db.Courses.AddRange(
            new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" },
            new Course { ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II", Credits = 4m, Department = "Math" },
            new Course { ClassId = "CPRE-1850", Code = "CprE 1850", Name = "Prob Solv", Credits = 3m, Department = "CprE" });
        await db.SaveChangesAsync();

        var repo = new CourseRepository(db);
        var math = await repo.ListByDepartmentAsync("Math");

        math.Should().HaveCount(2);
        math.Should().OnlyContain(c => c.Department == "Math");
    }

    [Fact]
    public async Task GetByClassIds_returns_only_matching()
    {
        using var db = InMemoryDb.Create();
        db.Courses.AddRange(
            new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" },
            new Course { ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II", Credits = 4m, Department = "Math" },
            new Course { ClassId = "CPRE-1850", Code = "CprE 1850", Name = "Prob Solv", Credits = 3m, Department = "CprE" });
        await db.SaveChangesAsync();

        var repo = new CourseRepository(db);
        var subset = await repo.GetByClassIdsAsync(new[] { "MATH-1650", "CPRE-1850", "PHANTOM-9999" });

        subset.Should().HaveCount(2);
        subset.Select(c => c.ClassId).Should().BeEquivalentTo(new[] { "MATH-1650", "CPRE-1850" });
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~CourseRepositoryTests"
```

Expected: build error — `CourseRepository` and `ICourseRepository` don't exist.

- [ ] **Step 3: Create the interface**

Create `src/ISUCourseManager.Data/Repositories/ICourseRepository.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Data.Repositories;

public interface ICourseRepository
{
    Task<Course?> GetByClassIdAsync(string classId, CancellationToken ct = default);
    Task<IReadOnlyList<Course>> ListAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Course>> ListByDepartmentAsync(string department, CancellationToken ct = default);
    Task<IReadOnlyList<Course>> GetByClassIdsAsync(IEnumerable<string> classIds, CancellationToken ct = default);
}
```

- [ ] **Step 4: Create the implementation**

Create `src/ISUCourseManager.Data/Repositories/CourseRepository.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;

namespace ISUCourseManager.Data.Repositories;

public class CourseRepository : ICourseRepository
{
    private readonly ApplicationDbContext _db;

    public CourseRepository(ApplicationDbContext db) => _db = db;

    public Task<Course?> GetByClassIdAsync(string classId, CancellationToken ct = default)
        => _db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.ClassId == classId, ct);

    public async Task<IReadOnlyList<Course>> ListAllAsync(CancellationToken ct = default)
        => await _db.Courses.AsNoTracking().ToListAsync(ct);

    public async Task<IReadOnlyList<Course>> ListByDepartmentAsync(string department, CancellationToken ct = default)
        => await _db.Courses.AsNoTracking().Where(c => c.Department == department).ToListAsync(ct);

    public async Task<IReadOnlyList<Course>> GetByClassIdsAsync(IEnumerable<string> classIds, CancellationToken ct = default)
    {
        var ids = classIds.ToHashSet();
        return await _db.Courses.AsNoTracking().Where(c => ids.Contains(c.ClassId)).ToListAsync(ct);
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~CourseRepositoryTests"
```

Expected: `Passed! - Failed: 0, Passed: 5, Skipped: 0`

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Data/Repositories/ICourseRepository.cs src/ISUCourseManager.Data/Repositories/CourseRepository.cs tests/ISUCourseManager.Data.Tests/CourseRepositoryTests.cs
git commit -m "feat(data): ICourseRepository + EF impl with TDD"
```

---

## Task 10: IDegreeFlowRepository + DegreeFlowRepository

**Files:**
- Create: `src/ISUCourseManager.Data/Repositories/IDegreeFlowRepository.cs`
- Create: `src/ISUCourseManager.Data/Repositories/DegreeFlowRepository.cs`
- Test: `tests/ISUCourseManager.Data.Tests/DegreeFlowRepositoryTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Data.Tests/DegreeFlowRepositoryTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Repositories;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class DegreeFlowRepositoryTests
{
    [Fact]
    public async Task GetByIdAsync_eager_loads_slots()
    {
        using var db = InMemoryDb.Create();
        var flow = new DegreeFlow { MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 125 };
        db.DegreeFlows.Add(flow);
        await db.SaveChangesAsync();

        db.FlowchartSlots.AddRange(
            new FlowchartSlot { DegreeFlowId = flow.Id, Semester = 1, DisplayOrder = 1, SlotType = SlotType.DegreeClass, ClassId = "MATH-1650" },
            new FlowchartSlot { DegreeFlowId = flow.Id, Semester = 1, DisplayOrder = 2, SlotType = SlotType.DegreeClass, ClassId = "ENGR-1010" });
        await db.SaveChangesAsync();

        var repo = new DegreeFlowRepository(db);
        var loaded = await repo.GetByIdAsync(flow.Id);

        loaded.Should().NotBeNull();
        loaded!.Slots.Should().HaveCount(2);
        loaded.Slots.Select(s => s.ClassId).Should().BeEquivalentTo(new[] { "MATH-1650", "ENGR-1010" });
    }

    [Fact]
    public async Task GetByMajorAndYearAsync_returns_match()
    {
        using var db = InMemoryDb.Create();
        db.DegreeFlows.AddRange(
            new DegreeFlow { MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 125 },
            new DegreeFlow { MajorCode = "CPRE", MajorName = "CprE", CatalogYear = "2025-26", TotalCreditsRequired = 123 });
        await db.SaveChangesAsync();

        var repo = new DegreeFlowRepository(db);
        var cybe = await repo.GetByMajorAndYearAsync("CYBE", "2025-26");

        cybe.Should().NotBeNull();
        cybe!.MajorName.Should().Be("CybE");
    }

    [Fact]
    public async Task ListAllSummariesAsync_does_not_load_slots()
    {
        using var db = InMemoryDb.Create();
        var flow = new DegreeFlow { MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 125 };
        db.DegreeFlows.Add(flow);
        await db.SaveChangesAsync();
        db.FlowchartSlots.Add(new FlowchartSlot { DegreeFlowId = flow.Id, Semester = 1, DisplayOrder = 1, SlotType = SlotType.DegreeClass, ClassId = "MATH-1650" });
        await db.SaveChangesAsync();

        var repo = new DegreeFlowRepository(db);
        var summaries = await repo.ListAllSummariesAsync();

        summaries.Should().HaveCount(1);
        summaries[0].Slots.Should().BeEmpty("ListAllSummariesAsync uses AsNoTracking + no Include — slots collection is unloaded");
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~DegreeFlowRepositoryTests"
```

Expected: build error.

- [ ] **Step 3: Create interface**

Create `src/ISUCourseManager.Data/Repositories/IDegreeFlowRepository.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Data.Repositories;

public interface IDegreeFlowRepository
{
    Task<DegreeFlow?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<DegreeFlow?> GetByMajorAndYearAsync(string majorCode, string catalogYear, CancellationToken ct = default);
    Task<IReadOnlyList<DegreeFlow>> ListAllSummariesAsync(CancellationToken ct = default);
}
```

- [ ] **Step 4: Create implementation**

Create `src/ISUCourseManager.Data/Repositories/DegreeFlowRepository.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;

namespace ISUCourseManager.Data.Repositories;

public class DegreeFlowRepository : IDegreeFlowRepository
{
    private readonly ApplicationDbContext _db;

    public DegreeFlowRepository(ApplicationDbContext db) => _db = db;

    public Task<DegreeFlow?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.DegreeFlows.Include(f => f.Slots).AsNoTracking().FirstOrDefaultAsync(f => f.Id == id, ct);

    public Task<DegreeFlow?> GetByMajorAndYearAsync(string majorCode, string catalogYear, CancellationToken ct = default)
        => _db.DegreeFlows.Include(f => f.Slots).AsNoTracking()
              .FirstOrDefaultAsync(f => f.MajorCode == majorCode && f.CatalogYear == catalogYear, ct);

    public async Task<IReadOnlyList<DegreeFlow>> ListAllSummariesAsync(CancellationToken ct = default)
        => await _db.DegreeFlows.AsNoTracking().ToListAsync(ct);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~DegreeFlowRepositoryTests"
```

Expected: `Passed! - Failed: 0, Passed: 3, Skipped: 0`

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Data/Repositories/IDegreeFlowRepository.cs src/ISUCourseManager.Data/Repositories/DegreeFlowRepository.cs tests/ISUCourseManager.Data.Tests/DegreeFlowRepositoryTests.cs
git commit -m "feat(data): IDegreeFlowRepository + EF impl"
```

---

## Task 11: IStudentRepository + StudentRepository

**Files:**
- Create: `src/ISUCourseManager.Data/Repositories/IStudentRepository.cs`
- Create: `src/ISUCourseManager.Data/Repositories/StudentRepository.cs`
- Test: `tests/ISUCourseManager.Data.Tests/StudentRepositoryTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Data.Tests/StudentRepositoryTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Repositories;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class StudentRepositoryTests
{
    [Fact]
    public async Task GetWithCoursesAndFlowsAsync_eager_loads()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course { ClassId = "MATH-1650", Code = "Math 1650", Name = "Calc I", Credits = 4m, Department = "Math" });
        var flow = new DegreeFlow { MajorCode = "CYBE", MajorName = "CybE", CatalogYear = "2025-26", TotalCreditsRequired = 125 };
        db.DegreeFlows.Add(flow);
        var student = new Student { DisplayName = "Luke" };
        db.Students.Add(student);
        await db.SaveChangesAsync();

        db.StudentCourses.Add(new StudentCourse { StudentId = student.Id, CourseId = "MATH-1650", AcademicTerm = 202602, Status = StudentCourseStatus.Completed, Grade = "A" });
        db.StudentDegreeFlows.Add(new StudentDegreeFlow { StudentId = student.Id, DegreeFlowId = flow.Id, Status = StudentDegreeFlowStatus.Active });
        await db.SaveChangesAsync();

        var repo = new StudentRepository(db);
        var loaded = await repo.GetWithCoursesAndFlowsAsync(student.Id);

        loaded.Should().NotBeNull();
        loaded!.Courses.Should().HaveCount(1);
        loaded.DegreeFlows.Should().HaveCount(1);
    }

    [Fact]
    public async Task AddCourseAsync_inserts()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course { ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II", Credits = 4m, Department = "Math" });
        var student = new Student { DisplayName = "Test" };
        db.Students.Add(student);
        await db.SaveChangesAsync();

        var repo = new StudentRepository(db);
        var added = await repo.AddCourseAsync(student.Id, courseId: "MATH-1660", academicTerm: 202604, status: StudentCourseStatus.Planned, grade: null);

        added.Id.Should().NotBeEmpty();
        var fromDb = await db.StudentCourses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == added.Id);
        fromDb.Should().NotBeNull();
        fromDb!.CourseId.Should().Be("MATH-1660");
        fromDb.AcademicTerm.Should().Be(202604);
        fromDb.Status.Should().Be(StudentCourseStatus.Planned);
    }

    [Fact]
    public async Task UpdateCourseStatusAsync_changes_status_and_grade()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course { ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II", Credits = 4m, Department = "Math" });
        var student = new Student { DisplayName = "Test" };
        db.Students.Add(student);
        await db.SaveChangesAsync();

        var sc = new StudentCourse { StudentId = student.Id, CourseId = "MATH-1660", AcademicTerm = 202604, Status = StudentCourseStatus.InProgress };
        db.StudentCourses.Add(sc);
        await db.SaveChangesAsync();

        var repo = new StudentRepository(db);
        await repo.UpdateCourseStatusAsync(sc.Id, StudentCourseStatus.Completed, grade: "B+");

        var reloaded = await db.StudentCourses.AsNoTracking().FirstAsync(c => c.Id == sc.Id);
        reloaded.Status.Should().Be(StudentCourseStatus.Completed);
        reloaded.Grade.Should().Be("B+");
    }

    [Fact]
    public async Task RemoveCourseAsync_deletes()
    {
        using var db = InMemoryDb.Create();
        db.Courses.Add(new Course { ClassId = "MATH-1660", Code = "Math 1660", Name = "Calc II", Credits = 4m, Department = "Math" });
        var student = new Student { DisplayName = "Test" };
        db.Students.Add(student);
        await db.SaveChangesAsync();
        var sc = new StudentCourse { StudentId = student.Id, CourseId = "MATH-1660", AcademicTerm = 202604, Status = StudentCourseStatus.Planned };
        db.StudentCourses.Add(sc);
        await db.SaveChangesAsync();

        var repo = new StudentRepository(db);
        await repo.RemoveCourseAsync(sc.Id);

        var leftover = await db.StudentCourses.AsNoTracking().AnyAsync(c => c.Id == sc.Id);
        leftover.Should().BeFalse();
    }
}
```

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~StudentRepositoryTests"
```

Expected: build error.

- [ ] **Step 3: Create interface**

Create `src/ISUCourseManager.Data/Repositories/IStudentRepository.cs`:

```csharp
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Data.Repositories;

public interface IStudentRepository
{
    Task<Student?> GetWithCoursesAndFlowsAsync(Guid studentId, CancellationToken ct = default);
    Task<StudentCourse> AddCourseAsync(Guid studentId, string courseId, int academicTerm, StudentCourseStatus status, string? grade, CancellationToken ct = default);
    Task UpdateCourseStatusAsync(Guid studentCourseId, StudentCourseStatus status, string? grade, CancellationToken ct = default);
    Task RemoveCourseAsync(Guid studentCourseId, CancellationToken ct = default);
}
```

- [ ] **Step 4: Create implementation**

Create `src/ISUCourseManager.Data/Repositories/StudentRepository.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;

namespace ISUCourseManager.Data.Repositories;

public class StudentRepository : IStudentRepository
{
    private readonly ApplicationDbContext _db;
    public StudentRepository(ApplicationDbContext db) => _db = db;

    public Task<Student?> GetWithCoursesAndFlowsAsync(Guid studentId, CancellationToken ct = default)
        => _db.Students.Include(s => s.Courses).Include(s => s.DegreeFlows).AsNoTracking()
              .FirstOrDefaultAsync(s => s.Id == studentId, ct);

    public async Task<StudentCourse> AddCourseAsync(Guid studentId, string courseId, int academicTerm, StudentCourseStatus status, string? grade, CancellationToken ct = default)
    {
        var sc = new StudentCourse
        {
            StudentId = studentId,
            CourseId = courseId,
            AcademicTerm = academicTerm,
            Status = status,
            Grade = grade,
        };
        _db.StudentCourses.Add(sc);
        await _db.SaveChangesAsync(ct);
        return sc;
    }

    public async Task UpdateCourseStatusAsync(Guid studentCourseId, StudentCourseStatus status, string? grade, CancellationToken ct = default)
    {
        var sc = await _db.StudentCourses.FirstOrDefaultAsync(c => c.Id == studentCourseId, ct)
            ?? throw new InvalidOperationException($"StudentCourse {studentCourseId} not found");
        // Status is `init` per spec, so we can't reassign — use entity-replacement pattern.
        // Simplest: delete + re-insert preserving Id.
        _db.StudentCourses.Remove(sc);
        await _db.SaveChangesAsync(ct);
        var replacement = new StudentCourse
        {
            Id = sc.Id,
            StudentId = sc.StudentId,
            CourseId = sc.CourseId,
            AcademicTerm = sc.AcademicTerm,
            Status = status,
            Grade = grade,
        };
        _db.StudentCourses.Add(replacement);
        await _db.SaveChangesAsync(ct);
    }

    public async Task RemoveCourseAsync(Guid studentCourseId, CancellationToken ct = default)
    {
        var sc = await _db.StudentCourses.FirstOrDefaultAsync(c => c.Id == studentCourseId, ct);
        if (sc != null)
        {
            _db.StudentCourses.Remove(sc);
            await _db.SaveChangesAsync(ct);
        }
    }
}
```

(The `init`-property workaround in `UpdateCourseStatusAsync` is awkward but matches the entity's immutability stance from plan #1. A cleaner fix is to switch the entity's `Status`, `Grade` setters from `init` to `set` — defer that to a future plan if it becomes painful.)

- [ ] **Step 5: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~StudentRepositoryTests"
```

Expected: `Passed! - Failed: 0, Passed: 4, Skipped: 0`

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Data/Repositories/IStudentRepository.cs src/ISUCourseManager.Data/Repositories/StudentRepository.cs tests/ISUCourseManager.Data.Tests/StudentRepositoryTests.cs
git commit -m "feat(data): IStudentRepository + EF impl with course CRUD"
```

---

## Task 12: DbSeedRunner — persist seed JSONs into the database

**Files:**
- Create: `src/ISUCourseManager.Data/Seed/DbSeedRunner.cs`
- Test: `tests/ISUCourseManager.Data.Tests/DbSeedRunnerTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/ISUCourseManager.Data.Tests/DbSeedRunnerTests.cs`:

```csharp
using FluentAssertions;
using ISUCourseManager.Data.Seed;
using ISUCourseManager.Data.Tests.Helpers;

namespace ISUCourseManager.Data.Tests;

public class DbSeedRunnerTests
{
    private const string CatalogPath = "../../../../../Documentation/seed-templates/isu-catalog.json";
    private const string FlowPath    = "../../../../../Data/cybe_flowchart.json";

    [Fact]
    public async Task SeedAsync_loads_catalog_into_DB()
    {
        using var db = InMemoryDb.Create();
        var runner = new DbSeedRunner(db);

        await runner.SeedAsync(CatalogPath, FlowPath);

        var courseCount = db.Courses.Count();
        var flowCount = db.DegreeFlows.Count();
        var slotCount = db.FlowchartSlots.Count();

        courseCount.Should().BeGreaterThan(30, "the seed catalog has ~40 courses");
        flowCount.Should().Be(1, "one DegreeFlow seeded (CybE 2025-26)");
        slotCount.Should().BeGreaterThan(40, "the CybE flow has 40+ slots");
    }

    [Fact]
    public async Task SeedAsync_is_idempotent_with_already_seeded_DB()
    {
        using var db = InMemoryDb.Create();
        var runner = new DbSeedRunner(db);

        await runner.SeedAsync(CatalogPath, FlowPath);
        var firstCount = db.Courses.Count();

        await runner.SeedAsync(CatalogPath, FlowPath);   // run again
        var secondCount = db.Courses.Count();

        secondCount.Should().Be(firstCount, "second SeedAsync is a no-op when DB already populated");
    }

    [Fact]
    public async Task SeedAsync_does_nothing_if_DB_already_has_courses()
    {
        using var db = InMemoryDb.Create();
        // Pre-populate with one course
        db.Courses.Add(new ISUCourseManager.Data.Entity.Course
        {
            ClassId = "FAKE-0000", Code = "Fake 0", Name = "Fake", Credits = 0m, Department = "Fake",
        });
        await db.SaveChangesAsync();

        var runner = new DbSeedRunner(db);
        await runner.SeedAsync(CatalogPath, FlowPath);

        db.Courses.Count().Should().Be(1, "SeedAsync skips when the DB already contains courses");
    }
}
```

The test paths reference seed files that already live in the repo. Tests run from the test project's `bin/Debug/net8.0/` directory; the relative paths walk up the appropriate number of `..`. If your local layout differs, adjust.

- [ ] **Step 2: Run to verify failure**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~DbSeedRunnerTests"
```

Expected: build error — `DbSeedRunner` doesn't exist.

- [ ] **Step 3: Create DbSeedRunner**

Create `src/ISUCourseManager.Data/Seed/DbSeedRunner.cs`:

```csharp
using ISUCourseManager.Data.Entity;
using Microsoft.EntityFrameworkCore;

namespace ISUCourseManager.Data.Seed;

/// <summary>
/// Loads the catalog + flow JSON files via SeedLoader (plan #1) and persists
/// them into the database. Skips if the DB already contains any courses
/// (idempotent — safe to call on every app startup).
/// </summary>
public class DbSeedRunner
{
    private readonly ApplicationDbContext _db;

    public DbSeedRunner(ApplicationDbContext db) => _db = db;

    public async Task SeedAsync(string catalogJsonPath, string flowJsonPath, CancellationToken ct = default)
    {
        if (await _db.Courses.AnyAsync(ct))
            return;   // idempotent — already seeded

        // Load catalog
        var catalog = SeedLoader.LoadCatalog(catalogJsonPath);
        _db.Courses.AddRange(catalog);

        // Load flow + its slots
        var flow = SeedLoader.LoadFlow(flowJsonPath);
        _db.DegreeFlows.Add(flow);   // EF cascades the Slots collection

        await _db.SaveChangesAsync(ct);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
dotnet test tests/ISUCourseManager.Data.Tests/ISUCourseManager.Data.Tests.csproj --filter "FullyQualifiedName~DbSeedRunnerTests"
```

Expected: `Passed! - Failed: 0, Passed: 3, Skipped: 0`

If the path-resolution test fails, the `CatalogPath`/`FlowPath` constants need adjusting for your local layout. Verify by `ls`-ing the absolute path.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Data/Seed/DbSeedRunner.cs tests/ISUCourseManager.Data.Tests/DbSeedRunnerTests.cs
git commit -m "feat(data): DbSeedRunner — persist seed JSONs into DB, idempotent"
```

---

## Task 13: Wire the DbContext + DbSeedRunner into the Api startup

**Files:**
- Modify: `src/ISUCourseManager.Api/Program.cs`
- Create: `src/ISUCourseManager.Api/appsettings.Development.json`

- [ ] **Step 1: Add appsettings.Development.json**

Create `src/ISUCourseManager.Api/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=isucm-dev.db"
  },
  "Seed": {
    "CatalogJsonPath": "../../Documentation/seed-templates/isu-catalog.json",
    "FlowJsonPath": "../../Data/cybe_flowchart.json"
  }
}
```

- [ ] **Step 2: Update Program.cs to register DbContext + repos + run seed**

Replace `src/ISUCourseManager.Api/Program.cs` with:

```csharp
using ISUCourseManager.Data;
using ISUCourseManager.Data.Repositories;
using ISUCourseManager.Data.Seed;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// DbContext — SQLite for POC (per spec §3); swap provider for prod
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=isucm-dev.db";
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString));

// Repositories
builder.Services.AddScoped<ICourseRepository, CourseRepository>();
builder.Services.AddScoped<IDegreeFlowRepository, DegreeFlowRepository>();
builder.Services.AddScoped<IStudentRepository, StudentRepository>();
builder.Services.AddScoped<DbSeedRunner>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Apply migrations + run seed on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();   // applies any pending migrations

    var seedRunner = scope.ServiceProvider.GetRequiredService<DbSeedRunner>();
    var catalogPath = builder.Configuration["Seed:CatalogJsonPath"]
        ?? throw new InvalidOperationException("Seed:CatalogJsonPath missing from configuration");
    var flowPath = builder.Configuration["Seed:FlowJsonPath"]
        ?? throw new InvalidOperationException("Seed:FlowJsonPath missing from configuration");
    await seedRunner.SeedAsync(catalogPath, flowPath);
}

app.UseHttpsRedirection();
app.MapControllers();

app.Run();
```

- [ ] **Step 3: Build the solution**

```
dotnet build ISUCourseManager.sln
```

Expected: `Build succeeded.`

- [ ] **Step 4: Run the API as a smoke test**

```
dotnet run --project src/ISUCourseManager.Api
```

Expected console output:
- `Now listening on: https://localhost:....`
- A SQLite file `isucm-dev.db` appears in `src/ISUCourseManager.Api/`
- (No exceptions on startup — migrations applied + seed loaded successfully)

Stop with Ctrl+C.

- [ ] **Step 5: Inspect the seeded DB**

```
sqlite3 src/ISUCourseManager.Api/isucm-dev.db "SELECT COUNT(*) FROM courses;"
sqlite3 src/ISUCourseManager.Api/isucm-dev.db "SELECT COUNT(*) FROM flowchart_slots;"
sqlite3 src/ISUCourseManager.Api/isucm-dev.db "SELECT major_code, catalog_year, total_credits_required FROM degree_flows;"
```

Expected: 30+ courses, 40+ slots, one DegreeFlow row `CYBE | 2025-26 | 125`.

- [ ] **Step 6: Run the full test suite to ensure nothing regressed**

```
dotnet test ISUCourseManager.sln
```

Expected: all tests pass across both `ISUCourseManager.Services.Tests` (from plan #1) and `ISUCourseManager.Data.Tests` (this plan).

- [ ] **Step 7: Commit**

```
git add src/ISUCourseManager.Api/Program.cs src/ISUCourseManager.Api/appsettings.Development.json
git commit -m "feat(api): register DbContext + repos; apply migrations and seed on startup"
```

---

## Task 14: Self-review + final regression check

**Files:** none modified.

- [ ] **Step 1: Run every test in the solution**

```
dotnet test ISUCourseManager.sln --logger "console;verbosity=normal"
```

Expected:
- All `ApplicationDbContextTests` pass (2 tests)
- All `CourseConfigurationTests` pass (5 tests)
- All `DegreeFlowConfigurationTests` pass (4 tests)
- All `StudentConfigurationTests` pass (3 tests)
- All `CourseRepositoryTests` pass (5 tests)
- All `DegreeFlowRepositoryTests` pass (3 tests)
- All `StudentRepositoryTests` pass (4 tests)
- All `DbSeedRunnerTests` pass (3 tests)
- Plus all tests from plan #1 (`Services.Tests`)

Total new for this plan: **29 tests**.

- [ ] **Step 2: Verify the migration is reversible**

```
dotnet ef database update 0 \
  --project src/ISUCourseManager.Data/ISUCourseManager.Data.csproj \
  --startup-project src/ISUCourseManager.Api/ISUCourseManager.Api.csproj
```

Expected: `Reverting migration 'InitialCreate'... Done.`

Then re-apply:
```
dotnet ef database update \
  --project src/ISUCourseManager.Data/ISUCourseManager.Data.csproj \
  --startup-project src/ISUCourseManager.Api/ISUCourseManager.Api.csproj
```

Expected: `Applying migration 'InitialCreate'... Done.`

If reversion fails (unusual for an InitialCreate), inspect the generated migration's `Down()` method.

- [ ] **Step 3: No commit needed** — Task 14 is verification only.

---

## Done

When all tasks are complete you'll have:

- A SQLite database (`isucm-dev.db`) created on first API startup
- All six entity tables with proper schema (JSON columns for prereq trees, cross-listings, term offerings, recommended pairings, notes)
- Seeded with the real CybE 2025-26 catalog (40+ courses) and DegreeFlow (40+ slots)
- Three repositories exercising the schema with 12 integration tests
- The API project starts cleanly, applies migrations, runs the idempotent seed
- 29 new tests in `ISUCourseManager.Data.Tests`, all green
- Clean foundation for plan #3 (cascade engine — operates on entities loaded via these repositories)

Next plan in the queue: **Plan #3 — Cascade engine** (pure C# implementation of the spec's algorithm + 31 acceptance criteria, depending on this plan's repositories for loading data into the engine's pure-function inputs).
