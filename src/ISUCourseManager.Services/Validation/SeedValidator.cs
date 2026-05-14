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

    public static ValidationReport ValidateFlow(DegreeFlow flow, IEnumerable<Course> catalog)
    {
        var report = new ValidationReport();
        var classIds = catalog.Select(c => c.ClassId).ToHashSet();
        var slotClassIds = flow.Slots
            .Where(s => s.ClassId is not null)
            .Select(s => s.ClassId!)
            .ToHashSet();

        foreach (var slot in flow.Slots)
        {
            if (slot.SlotType == SlotType.DegreeClass)
            {
                if (slot.ClassId is null)
                    report.Add(SeedIssueKind.MissingClassId, IssueSeverity.Error,
                        $"Slot at semester {slot.Semester} order {slot.DisplayOrder} is DegreeClass but has no classId",
                        location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
                else if (!classIds.Contains(slot.ClassId))
                    report.Add(SeedIssueKind.OrphanFlowReference, IssueSeverity.Error,
                        $"Slot references classId '{slot.ClassId}' not in catalog",
                        location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
                if (slot.RequiredCredits is not null)
                    report.Add(SeedIssueKind.RedundantSlotCredits, IssueSeverity.Warning,
                        $"DegreeClass slot for {slot.ClassId} declares requiredCredits={slot.RequiredCredits} — should be null (use Course.Credits)",
                        location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
            }
            else  // Elective* slot
            {
                if (slot.RequiredCredits is null)
                    report.Add(SeedIssueKind.MissingElectiveCredits, IssueSeverity.Error,
                        $"Elective slot ({slot.SlotType}) at semester {slot.Semester} order {slot.DisplayOrder} has no requiredCredits",
                        location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
                if (slot.ClassId is not null)
                    report.Add(SeedIssueKind.UnexpectedClassIdOnElective, IssueSeverity.Warning,
                        $"Elective slot ({slot.SlotType}) at semester {slot.Semester} order {slot.DisplayOrder} has classId='{slot.ClassId}' — should be null",
                        location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}]");
            }

            foreach (var pairing in slot.RecommendedPairing)
            {
                if (!classIds.Contains(pairing))
                    report.Add(SeedIssueKind.OrphanRecommendedPairingClass, IssueSeverity.Error,
                        $"Slot {slot.ClassId} pairs with '{pairing}' which is not in the catalog",
                        location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}].recommendedPairing");
                else if (!slotClassIds.Contains(pairing))
                    report.Add(SeedIssueKind.PairingClassNotInFlow, IssueSeverity.Warning,
                        $"Slot {slot.ClassId} pairs with '{pairing}' which exists in catalog but not in this flow",
                        location: $"flow:{flow.MajorCode}.slot[{slot.Semester},{slot.DisplayOrder}].recommendedPairing");
            }
        }

        var dupePositions = flow.Slots
            .GroupBy(s => (s.Semester, s.DisplayOrder))
            .Where(g => g.Count() > 1);

        foreach (var dupe in dupePositions)
            report.Add(SeedIssueKind.DuplicateSlotPosition, IssueSeverity.Error,
                $"{dupe.Count()} slots share semester {dupe.Key.Semester} displayOrder {dupe.Key.DisplayOrder}",
                location: $"flow:{flow.MajorCode}.slot[{dupe.Key.Semester},{dupe.Key.DisplayOrder}]");

        // Sum DegreeClass slots from Course.Credits + Elective* slots from slot.RequiredCredits.
        var coursesByClassId = catalog.ToDictionary(c => c.ClassId);
        decimal sum = 0m;
        foreach (var slot in flow.Slots)
        {
            if (slot.SlotType == SlotType.DegreeClass && slot.ClassId is not null
                && coursesByClassId.TryGetValue(slot.ClassId, out var course))
            {
                sum += course.Credits;
            }
            else if (slot.SlotType != SlotType.DegreeClass)
            {
                sum += slot.RequiredCredits ?? 0m;
            }
        }
        if (sum != flow.TotalCreditsRequired)
            report.Add(SeedIssueKind.CreditTotalMismatch, IssueSeverity.Warning,
                $"Sum of slot credits ({sum}) does not match totalCreditsRequired ({flow.TotalCreditsRequired})",
                location: $"flow:{flow.MajorCode}");

        return report;
    }
}
