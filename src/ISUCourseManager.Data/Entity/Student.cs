namespace ISUCourseManager.Data.Entity;

public sealed class Student
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string DisplayName { get; init; }

    // Convenience navigation collections (EF maps these via FK on the child).
    public List<StudentCourse> Courses { get; init; } = new();
    public List<StudentDegreeFlow> DegreeFlows { get; init; } = new();
}
