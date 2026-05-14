using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Validation;

public static class SeedValidator
{
    public static ValidationReport ValidateCatalog(IEnumerable<Course> catalog)
    {
        var report = new ValidationReport();
        var courses = catalog.ToList();
        var classIds = courses.Select(c => c.ClassId).ToHashSet();

        CheckDuplicateClassIds(courses, report);
        CheckCrossListings(courses, classIds, report);
        CheckPrereqReferences(courses, classIds, report);
        return report;
    }

    private static void CheckDuplicateClassIds(IList<Course> courses, ValidationReport report)
    {
        var dupes = courses
            .GroupBy(c => c.ClassId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dupe in dupes)
            report.Add(SeedIssueKind.DuplicateClassId, IssueSeverity.Error,
                $"Catalog has {courses.Count(c => c.ClassId == dupe)} entries for classId '{dupe}'",
                location: $"catalog:{dupe}");
    }

    private static void CheckCrossListings(IList<Course> courses, HashSet<string> classIds, ValidationReport report)
    {
        foreach (var c in courses)
        {
            foreach (var xl in c.CrossListedAs)
            {
                if (!classIds.Contains(xl))
                    report.Add(SeedIssueKind.OrphanCrossListing, IssueSeverity.Error,
                        $"{c.ClassId} is cross-listed with {xl}, but {xl} is not in the catalog",
                        location: $"catalog:{c.ClassId}.crossListedAs[{xl}]");
            }
        }
    }

    private static void CheckPrereqReferences(IList<Course> courses, HashSet<string> classIds, ValidationReport report)
    {
        foreach (var c in courses)
        {
            VisitTree(c.Prereqs, c.ClassId, "prereqs", classIds, report);
            VisitTree(c.Coreqs, c.ClassId, "coreqs", classIds, report);
        }
    }

    private static void VisitTree(PrereqExpression? node, string ownerClassId, string fieldName, HashSet<string> classIds, ValidationReport report)
    {
        switch (node)
        {
            case null: return;
            case PrereqAnd a:
                foreach (var child in a.Children) VisitTree(child, ownerClassId, fieldName, classIds, report);
                break;
            case PrereqOr o:
                foreach (var child in o.Children) VisitTree(child, ownerClassId, fieldName, classIds, report);
                break;
            case PrereqCourse pc:
                if (!classIds.Contains(pc.ClassId))
                    report.Add(SeedIssueKind.OrphanPrereqReference, IssueSeverity.Error,
                        $"{ownerClassId}.{fieldName} references unknown class '{pc.ClassId}'",
                        location: $"catalog:{ownerClassId}.{fieldName}");
                break;
            case PrereqUnparsed pu:
                report.Add(SeedIssueKind.UnparsedPrereqString, IssueSeverity.Warning,
                    $"{ownerClassId}.{fieldName} contains unparsed string: \"{pu.Raw}\"",
                    location: $"catalog:{ownerClassId}.{fieldName}");
                break;
            // PrereqClassification and PrereqCoreCredits don't reference courses; nothing to check.
        }
    }
}
