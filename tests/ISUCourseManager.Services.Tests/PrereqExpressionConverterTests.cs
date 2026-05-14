using System.Text.Json;
using FluentAssertions;
using ISUCourseManager.Data.Entity;
using ISUCourseManager.Data.Seed;

namespace ISUCourseManager.Services.Tests;

public class PrereqExpressionConverterTests
{
    private readonly JsonSerializerOptions _opts = new()
    {
        Converters = { new PrereqExpressionConverter() },
    };

    [Fact]
    public void Course_node_round_trips()
    {
        var json = """{"type":"Course","classId":"MATH-1650"}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        node.Should().BeOfType<PrereqCourse>()
            .Which.ClassId.Should().Be("MATH-1650");
        var back = JsonSerializer.Serialize(node, _opts);
        JsonDocument.Parse(back).RootElement.GetProperty("classId").GetString().Should().Be("MATH-1650");
    }

    [Fact]
    public void Course_node_with_minGrade_and_acceptConcurrent_round_trips()
    {
        var json = """{"type":"Course","classId":"MATH-1650","minGrade":"C-","acceptConcurrent":true}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        var c = node.Should().BeOfType<PrereqCourse>().Subject;
        c.ClassId.Should().Be("MATH-1650");
        c.MinGrade.Should().Be("C-");
        c.AcceptConcurrent.Should().BeTrue();
    }

    [Fact]
    public void Or_node_with_three_courses_round_trips()
    {
        var json = """
        {"type":"Or","children":[
          {"type":"Course","classId":"CPRE-3080"},
          {"type":"Course","classId":"COMS-2520"},
          {"type":"Course","classId":"COMS-3520"}
        ]}
        """;
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        var or = node.Should().BeOfType<PrereqOr>().Subject;
        or.Children.Should().HaveCount(3);
        or.Children.Select(c => ((PrereqCourse)c).ClassId).Should().Equal("CPRE-3080", "COMS-2520", "COMS-3520");
    }

    [Fact]
    public void And_with_nested_Or_round_trips()
    {
        var json = """
        {"type":"And","children":[
          {"type":"Course","classId":"MATH-1660"},
          {"type":"Or","children":[
            {"type":"Course","classId":"MATH-2010"},
            {"type":"Course","classId":"COMS-2300"}
          ]}
        ]}
        """;
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        var and = node.Should().BeOfType<PrereqAnd>().Subject;
        and.Children.Should().HaveCount(2);
        and.Children[1].Should().BeOfType<PrereqOr>();
    }

    [Fact]
    public void Classification_node_round_trips()
    {
        var json = """{"type":"Classification","min":"Sophomore"}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        node.Should().BeOfType<PrereqClassification>()
            .Which.Min.Should().Be(Classification.Sophomore);
    }

    [Fact]
    public void CoreCredits_node_round_trips()
    {
        var json = """{"type":"CoreCredits","minCoreCredits":29}""";
        var node = JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        node.Should().BeOfType<PrereqCoreCredits>()
            .Which.MinCoreCredits.Should().Be(29m);
    }

    [Fact]
    public void Unknown_type_throws()
    {
        var json = """{"type":"NotARealType","whatever":1}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>().WithMessage("*NotARealType*");
    }

    [Fact]
    public void Course_node_missing_classId_throws_JsonException()
    {
        var json = """{"type":"Course"}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>().WithMessage("*classId*");
    }

    [Fact]
    public void Classification_node_missing_min_throws_JsonException()
    {
        var json = """{"type":"Classification"}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>().WithMessage("*min*");
    }

    [Fact]
    public void Classification_node_with_unknown_value_throws_JsonException()
    {
        var json = """{"type":"Classification","min":"Postgrad"}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>().WithMessage("*Postgrad*");
    }

    [Fact]
    public void Classification_node_with_numeric_string_throws_JsonException()
    {
        // Regression: Enum.Parse silently accepted any int-shaped string as a valid enum.
        var json = """{"type":"Classification","min":"99"}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>();
    }

    [Fact]
    public void CoreCredits_node_missing_minCoreCredits_throws_JsonException()
    {
        var json = """{"type":"CoreCredits"}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>().WithMessage("*minCoreCredits*");
    }

    [Fact]
    public void CoreCredits_node_with_string_minCoreCredits_throws_JsonException()
    {
        var json = """{"type":"CoreCredits","minCoreCredits":"29"}""";
        Action act = () => JsonSerializer.Deserialize<PrereqExpression>(json, _opts);
        act.Should().Throw<JsonException>().WithMessage("*number*");
    }
}
