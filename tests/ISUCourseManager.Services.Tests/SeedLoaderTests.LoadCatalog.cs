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
