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
