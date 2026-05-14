using System.Text.Json.Serialization;
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Data.Seed.Json;

internal sealed class CatalogJsonRoot
{
    [JsonPropertyName("_comment")] public string? Comment { get; init; }
    [JsonPropertyName("courses")] public List<CourseJson> Courses { get; init; } = new();
}

internal sealed class CourseJson
{
    [JsonPropertyName("classId")] public string ClassId { get; init; } = "";
    [JsonPropertyName("code")] public string Code { get; init; } = "";
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("officialName")] public string? OfficialName { get; init; }
    [JsonPropertyName("credits")] public decimal? Credits { get; init; }
    [JsonPropertyName("creditNote")] public string? CreditNote { get; init; }
    [JsonPropertyName("department")] public string Department { get; init; } = "";
    [JsonPropertyName("prereqs")] public PrereqExpression? Prereqs { get; init; }
    [JsonPropertyName("coreqs")] public PrereqExpression? Coreqs { get; init; }
    [JsonPropertyName("crossListedAs")] public List<string> CrossListedAs { get; init; } = new();
    [JsonPropertyName("typicallyOffered")] public List<string> TypicallyOffered { get; init; } = new();
    [JsonPropertyName("isActive")] public bool IsActive { get; init; } = true;
}
