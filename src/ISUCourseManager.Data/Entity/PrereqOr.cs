namespace ISUCourseManager.Data.Entity;

public sealed class PrereqOr : PrereqExpression
{
    public List<PrereqExpression> Children { get; init; } = new();
}
