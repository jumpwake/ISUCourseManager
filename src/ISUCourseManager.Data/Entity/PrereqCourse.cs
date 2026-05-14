namespace ISUCourseManager.Data.Entity;

public sealed class PrereqCourse : PrereqExpression
{
    public string ClassId { get; init; } = "";
    public string? MinGrade { get; init; }
    public bool AcceptConcurrent { get; init; }
}
