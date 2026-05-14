using FluentAssertions;
using ISUCourseManager.Data.Entity;

namespace ISUCourseManager.Services.Tests;

public class AcademicTermTests
{
    [Theory]
    [InlineData(2026, Season.Summer, 202601)]
    [InlineData(2026, Season.Fall,   202602)]
    [InlineData(2026, Season.Winter, 202603)]
    [InlineData(2026, Season.Spring, 202604)]
    public void Encode_packs_year_and_season(int year, Season season, int expected)
    {
        AcademicTerm.Encode(year, season).Should().Be(expected);
    }

    [Theory]
    [InlineData(202601, 2026, Season.Summer)]
    [InlineData(202602, 2026, Season.Fall)]
    [InlineData(202604, 2026, Season.Spring)]
    public void Decode_unpacks_year_and_season(int term, int expectedYear, Season expectedSeason)
    {
        var (y, s) = AcademicTerm.Decode(term);
        y.Should().Be(expectedYear);
        s.Should().Be(expectedSeason);
    }

    [Fact]
    public void Encoded_terms_sort_chronologically_within_a_year()
    {
        var terms = new[]
        {
            AcademicTerm.Encode(2026, Season.Spring),
            AcademicTerm.Encode(2026, Season.Summer),
            AcademicTerm.Encode(2026, Season.Winter),
            AcademicTerm.Encode(2026, Season.Fall),
        };
        terms.Order().Should().Equal(202601, 202602, 202603, 202604);
    }

    [Fact]
    public void Encoded_terms_sort_chronologically_across_years()
    {
        AcademicTerm.Encode(2025, Season.Spring).Should().BeLessThan(AcademicTerm.Encode(2026, Season.Summer));
    }

    [Fact]
    public void Decode_throws_on_invalid_season()
    {
        Action act = () => AcademicTerm.Decode(202699);  // 99 isn't a valid Season
        act.Should().Throw<ArgumentException>();
    }
}
