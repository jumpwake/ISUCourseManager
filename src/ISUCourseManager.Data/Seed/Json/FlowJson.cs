using System.Text.Json.Serialization;

namespace ISUCourseManager.Data.Seed.Json;

internal sealed class FlowJsonRoot
{
    [JsonPropertyName("code")] public string Code { get; init; } = "";
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("catalogYear")] public string CatalogYear { get; init; } = "";
    [JsonPropertyName("totalCreditsRequired")] public int TotalCreditsRequired { get; init; }
    [JsonPropertyName("notes")] public List<string> Notes { get; init; } = new();
    [JsonPropertyName("slots")] public List<SlotJson> Slots { get; init; } = new();
}

internal sealed class SlotJson
{
    [JsonPropertyName("semester")] public int Semester { get; init; }
    [JsonPropertyName("slotType")] public string SlotType { get; init; } = "DegreeClass";
    [JsonPropertyName("classId")] public string? ClassId { get; init; }
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("requiredCredits")] public decimal? RequiredCredits { get; init; }
    [JsonPropertyName("creditNote")] public string? CreditNote { get; init; }
    [JsonPropertyName("minGrade")] public string? MinGrade { get; init; }
    [JsonPropertyName("classNote")] public string? ClassNote { get; init; }
    [JsonPropertyName("displayOrder")] public int DisplayOrder { get; init; }
    [JsonPropertyName("recommendedPairing")] public List<string> RecommendedPairing { get; init; } = new();
}
