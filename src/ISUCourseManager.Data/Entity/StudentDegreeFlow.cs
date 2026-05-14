namespace ISUCourseManager.Data.Entity;

/// <summary>
/// Junction associating a Student with a DegreeFlow + lifecycle Status. A student
/// can have many of these — multiple Active rows model double majors; Pending rows
/// model what-if exploration without commitment. No uniqueness constraint on
/// (StudentId, Status=Active).
/// </summary>
public sealed class StudentDegreeFlow
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required Guid StudentId { get; init; }
    public required Guid DegreeFlowId { get; init; }
    public required StudentDegreeFlowStatus Status { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public DateTime? StatusChangedAt { get; init; }
}
