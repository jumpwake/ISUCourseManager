namespace ISUCourseManager.Data.Entity;

/// <summary>
/// What this flowchart slot represents. DegreeClass = a specific required course
/// (paired with ClassId). The Elective* values are placeholder slots the user fills
/// with their own choice from the catalog filtered to that category.
/// </summary>
public enum SlotType
{
    DegreeClass,        // specific required course (ClassId is populated)
    ElectiveGenEd,      // any approved general-education elective
    ElectiveMath,       // any approved math elective
    ElectiveTech,       // any approved technical elective (open list)
    ElectiveCybE,       // any approved Cyber Security Engineering elective
    ElectiveCprE,       // any approved Computer Engineering elective
}

public enum Term
{
    Fall,
    Spring,
    Summer,
}

public enum Season
{
    Summer = 1,
    Fall   = 2,
    Winter = 3,
    Spring = 4,
}

public enum StudentCourseStatus
{
    Planned,
    InProgress,
    Completed,
    Failed,
    Withdrawn,
}

public enum StudentDegreeFlowStatus
{
    Pending,
    Active,
    Deleted,
    Completed,
}

public enum Classification
{
    Freshman,
    Sophomore,
    Junior,
    Senior,
}

/// <summary>
/// Discriminator on StudentCourse: Internal = taken at ISU (default);
/// External = taken at another institution and transferred back as ISU credit.
/// Added by external-transfer addendum spec (2026-05-13).
/// </summary>
public enum EnrollmentSource
{
    Internal = 1,  // taken at ISU (default)
    External = 2,  // taken at an external institution, transferred back
}
