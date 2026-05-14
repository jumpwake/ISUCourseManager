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
}
