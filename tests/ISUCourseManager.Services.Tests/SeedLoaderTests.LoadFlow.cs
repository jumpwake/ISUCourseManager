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
        flow.Slots.Should().HaveCountGreaterThanOrEqualTo(40);
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
