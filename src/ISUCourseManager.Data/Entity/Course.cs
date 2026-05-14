namespace ISUCourseManager.Data.Entity;

public sealed class Course
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string ClassId { get; init; }            // "MATH-1650"
    public required string Code { get; init; }               // "Math 1650"
    public required string Name { get; init; }               // chart abbreviation
    public string? OfficialName { get; init; }               // catalog name
    public required decimal Credits { get; init; }
    public string? CreditNote { get; init; }                 // "R cr", "3/4cr"
    public required string Department { get; init; }
    public PrereqExpression? Prereqs { get; init; }
    public PrereqExpression? Coreqs { get; init; }
    public List<string> CrossListedAs { get; init; } = new();
    public List<Term> TypicallyOffered { get; init; } = new();
    public bool IsActive { get; init; } = true;
}
