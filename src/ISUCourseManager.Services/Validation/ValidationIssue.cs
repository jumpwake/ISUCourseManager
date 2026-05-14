namespace ISUCourseManager.Services.Validation;

public enum SeedIssueKind
{
    DuplicateClassId,
    MissingClassId,
    OrphanFlowReference,
    OrphanPrereqReference,
    OrphanCrossListing,
    OrphanRecommendedPairingClass,    // pairing references a classId not in the catalog
    PairingClassNotInFlow,            // pairing references a class in catalog but not in this flow (warning)
    DuplicateSlotPosition,
    CreditTotalMismatch,
    UnparsedPrereqString,
    InvalidGrade,
    MissingElectiveCredits,           // Elective* slot has no requiredCredits
    RedundantSlotCredits,             // DegreeClass slot has requiredCredits set (warning)
    UnexpectedClassIdOnElective,      // Elective* slot has classId set (warning)
}

public enum IssueSeverity
{
    Error,
    Warning,
}

public sealed record ValidationIssue(
    SeedIssueKind Kind,
    IssueSeverity Severity,
    string Message,
    string? Location = null);
