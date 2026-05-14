namespace ISUCourseManager.Data.Entity;

/// <summary>
/// One enrollment record. Lives directly on Student — independent of any DegreeFlow,
/// so the same StudentCourse[] overlays cleanly against any flow the student is
/// associated with (Active or Pending). Status carries the lifecycle of this single
/// enrollment; AcademicTerm gives the chronological position (YYYYSS).
/// </summary>
public sealed class StudentCourse
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required Guid StudentId { get; init; }
    public required string CourseId { get; init; }            // matches Course.ClassId (e.g. "MATH-1650")
    public required int AcademicTerm { get; init; }           // YYYYSS — see AcademicTerm helper
    public required StudentCourseStatus Status { get; init; }
    public string? Grade { get; init; }                       // populated for Completed/Failed
                                                              // Note: Status=Completed + Grade=null is the
                                                              // "grade pending" state (pending-grade addendum spec).

    // External-transfer addendum (2026-05-13-external-transfer-v1-design.md §3).
    // CourseId still references the ISU equivalent regardless of EnrollmentSource;
    // the Transfer* fields capture the external enrollment metadata.
    public EnrollmentSource EnrollmentSource { get; set; } = EnrollmentSource.Internal;
    public string? TransferInstitution { get; set; }          // required when EnrollmentSource = External
    public string? TransferExternalCourseCode { get; set; }   // required when EnrollmentSource = External
    public string? TransferNote { get; set; }                 // optional free-text note
}
