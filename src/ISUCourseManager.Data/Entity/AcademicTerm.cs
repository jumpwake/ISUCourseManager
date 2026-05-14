namespace ISUCourseManager.Data.Entity;

/// <summary>
/// Encode/decode for the YYYYSS AcademicTerm packed-int format.
/// Year is the *ending* year of the academic cycle (school year 2025-26 → 2026).
/// Season values: Summer=1, Fall=2, Winter=3, Spring=4 (chronological within year).
/// </summary>
public static class AcademicTerm
{
    public static int Encode(int year, Season season)
        => year * 100 + (int)season;

    public static (int Year, Season Season) Decode(int term)
    {
        var year = term / 100;
        var seasonInt = term % 100;
        if (!Enum.IsDefined(typeof(Season), seasonInt))
            throw new ArgumentException($"Invalid season {seasonInt} in AcademicTerm {term}", nameof(term));
        return (year, (Season)seasonInt);
    }
}
