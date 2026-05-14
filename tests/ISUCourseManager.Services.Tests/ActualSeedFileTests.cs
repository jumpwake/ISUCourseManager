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
