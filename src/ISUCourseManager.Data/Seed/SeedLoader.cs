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
        var trimmed = raw.Trim().Replace(" ", " ");
        if (trimmed.Contains('-')) return trimmed;
        // Use LastIndexOf so compound department names ("Com S 2270") collapse correctly:
        //   "Com S 2270" -> "ComS-2270", not "Com-S 2270".
        var lastSpace = trimmed.LastIndexOf(' ');
        return lastSpace > 0
            ? $"{trimmed[..lastSpace].Replace(" ", "")}-{trimmed[(lastSpace + 1)..]}"
            : trimmed;
    }
}
