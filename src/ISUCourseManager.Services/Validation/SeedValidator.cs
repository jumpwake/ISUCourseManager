using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Validation;

public static class SeedValidator
{
    public static ValidationReport ValidateCatalog(IEnumerable<Course> catalog)
    {
        var report = new ValidationReport();
        var courses = catalog.ToList();
        CheckDuplicateClassIds(courses, report);
        return report;
    }

    private static void CheckDuplicateClassIds(IList<Course> courses, ValidationReport report)
    {
        var dupes = courses
            .GroupBy(c => c.ClassId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dupe in dupes)
        {
            report.Add(
                SeedIssueKind.DuplicateClassId,
                IssueSeverity.Error,
                $"Catalog has {courses.Count(c => c.ClassId == dupe)} entries for classId '{dupe}'",
                location: $"catalog:{dupe}");
        }
    }
}
