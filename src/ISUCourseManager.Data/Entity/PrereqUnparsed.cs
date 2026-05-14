namespace ISUCourseManager.Data.Entity;

/// <summary>
/// Escape-hatch node for prereq strings the catalog generator could not
/// auto-convert to a structured tree. Carries the raw catalog text for
/// human review. Cascade engine treats these as "unknown — fail safe."
/// </summary>
public sealed class PrereqUnparsed : PrereqExpression
{
    public required string Raw { get; init; }
}
