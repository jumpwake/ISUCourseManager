namespace ISUCourseManager.Data.Entity;

public sealed class DegreeFlow
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string MajorCode { get; init; }      // "CYBE"
    public required string MajorName { get; init; }      // "Cyber Security Engineering"
    public required string CatalogYear { get; init; }    // "2025-26"
    public required int TotalCreditsRequired { get; init; }
    public List<string> Notes { get; init; } = new();
    public List<FlowchartSlot> Slots { get; init; } = new();
}
