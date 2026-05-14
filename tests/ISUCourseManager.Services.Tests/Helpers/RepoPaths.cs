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
