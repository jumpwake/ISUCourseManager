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

    private static FlowchartSlot MakeSlot(int sem, int order, string? classId = null,
                                          SlotType slotType = SlotType.DegreeClass,
                                          decimal? credits = null,
                                          string[]? pairing = null) => new()
    {
        Semester = sem,
        DisplayOrder = order,
        SlotType = slotType,
        ClassId = classId,
        // For DegreeClass slots, credits are null (read from Course.Credits); for Elective* slots, credits is set.
        RequiredCredits = slotType == SlotType.DegreeClass ? null : (credits ?? 3m),
        RecommendedPairing = pairing?.ToList() ?? new(),
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
            Slots = { MakeSlot(1, 1, classId: "CPRE-1850", credits: 3, pairing: new[] { "PHANTOM-1234" }) },
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
            Slots = { MakeSlot(1, 1, classId: "CPRE-1850", credits: 3, pairing: new[] { "MATH-1650" }) },
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
}
