namespace ISUCourseManager.Services.Validation;

public sealed class ValidationReport
{
    private readonly List<ValidationIssue> _issues = new();

    public IReadOnlyList<ValidationIssue> Issues => _issues;
    public IEnumerable<ValidationIssue> Errors => _issues.Where(i => i.Severity == IssueSeverity.Error);
    public IEnumerable<ValidationIssue> Warnings => _issues.Where(i => i.Severity == IssueSeverity.Warning);

    public bool IsValid => !Errors.Any();

    public void Add(SeedIssueKind kind, IssueSeverity severity, string message, string? location = null)
        => _issues.Add(new ValidationIssue(kind, severity, message, location));

    public override string ToString() =>
        Issues.Count == 0
            ? "No issues."
            : string.Join("\n", Issues.Select(i => $"[{i.Severity}] {i.Kind}: {i.Message}{(i.Location is null ? "" : $" ({i.Location})")}"));
}
