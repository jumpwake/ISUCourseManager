namespace ISUCourseManager.Data.Entity;

public sealed class PrereqAnd : PrereqExpression
{
    public List<PrereqExpression> Children { get; init; } = new();
}
