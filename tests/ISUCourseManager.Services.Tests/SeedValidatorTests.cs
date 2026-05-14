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
