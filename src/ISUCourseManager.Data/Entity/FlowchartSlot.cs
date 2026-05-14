namespace ISUCourseManager.Data.Entity;

public sealed class FlowchartSlot
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DegreeFlowId { get; init; }
    public required int Semester { get; init; }
    public required SlotType SlotType { get; init; }       // single enum: DegreeClass or Elective*
    public string? ClassId { get; init; }                  // populated when SlotType == DegreeClass
    public string? DisplayName { get; init; }              // chart abbreviation override
    public decimal? RequiredCredits { get; init; }         // null for DegreeClass (uses Course.Credits);
                                                           //   set for Elective* slots (declares budget)
    public string? CreditNote { get; init; }
    public string? MinGrade { get; init; }
    public string? ClassNote { get; init; }
    public required int DisplayOrder { get; init; }
    public List<string> RecommendedPairing { get; init; } = new();
}
