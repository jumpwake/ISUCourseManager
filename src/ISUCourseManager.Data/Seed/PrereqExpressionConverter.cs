using System.Text.Json;
using System.Text.Json.Serialization;
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Data.Seed;

/// <summary>
/// Polymorphic converter for PrereqExpression that uses a "type" discriminator
/// matching the JSON seed file format.
/// </summary>
public sealed class PrereqExpressionConverter : JsonConverter<PrereqExpression>
{
    public override PrereqExpression Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        // Escape hatch: nodes shaped { "_unparsed": "raw catalog text" }
        if (root.TryGetProperty("_unparsed", out var u))
            return new PrereqUnparsed { Raw = u.GetString() ?? "" };

        if (!root.TryGetProperty("type", out var typeProp))
            throw new JsonException("PrereqExpression node is missing 'type' field");

        var type = typeProp.GetString();
        return type switch
        {
            "Course" => new PrereqCourse
            {
                ClassId = root.GetProperty("classId").GetString() ?? "",
                MinGrade = root.TryGetProperty("minGrade", out var mg) && mg.ValueKind == JsonValueKind.String ? mg.GetString() : null,
                AcceptConcurrent = root.TryGetProperty("acceptConcurrent", out var ac) && ac.ValueKind == JsonValueKind.True,
            },
            "And" => new PrereqAnd { Children = ReadChildren(root, options) },
            "Or" => new PrereqOr { Children = ReadChildren(root, options) },
            "Classification" => new PrereqClassification
            {
                Min = Enum.Parse<Classification>(root.GetProperty("min").GetString() ?? ""),
            },
            "CoreCredits" => new PrereqCoreCredits
            {
                MinCoreCredits = root.GetProperty("minCoreCredits").GetDecimal(),
            },
            _ => throw new JsonException($"Unknown PrereqExpression type: '{type}'"),
        };
    }

    private List<PrereqExpression> ReadChildren(JsonElement root, JsonSerializerOptions options)
    {
        if (!root.TryGetProperty("children", out var children) || children.ValueKind != JsonValueKind.Array)
            return new();
        var list = new List<PrereqExpression>();
        foreach (var child in children.EnumerateArray())
        {
            var raw = child.GetRawText();
            list.Add(JsonSerializer.Deserialize<PrereqExpression>(raw, options)!);
        }
        return list;
    }

    public override void Write(Utf8JsonWriter writer, PrereqExpression value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        switch (value)
        {
            case PrereqCourse c:
                writer.WriteString("type", "Course");
                writer.WriteString("classId", c.ClassId);
                if (c.MinGrade is not null)
                    writer.WriteString("minGrade", c.MinGrade);
                if (c.AcceptConcurrent)
                    writer.WriteBoolean("acceptConcurrent", true);
                break;
            case PrereqAnd a:
                writer.WriteString("type", "And");
                writer.WritePropertyName("children");
                JsonSerializer.Serialize(writer, a.Children, options);
                break;
            case PrereqOr o:
                writer.WriteString("type", "Or");
                writer.WritePropertyName("children");
                JsonSerializer.Serialize(writer, o.Children, options);
                break;
            case PrereqClassification cl:
                writer.WriteString("type", "Classification");
                writer.WriteString("min", cl.Min.ToString());
                break;
            case PrereqCoreCredits cc:
                writer.WriteString("type", "CoreCredits");
                writer.WriteNumber("minCoreCredits", cc.MinCoreCredits);
                break;
            case PrereqUnparsed pu:
                writer.WriteString("_unparsed", pu.Raw);
                break;
            default:
                throw new JsonException($"Cannot serialize unknown PrereqExpression type: {value.GetType()}");
        }
        writer.WriteEndObject();
    }
}
