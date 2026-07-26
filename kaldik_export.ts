
export const SCHOOL_CALENDAR_2026_2027 = {
    academicYear: "2026/2027",
    semester1: {
        start: new Date(2026, 6, 13), // Assuming July 13th start based on MPLS
        end: new Date(2026, 11, 23), // Assuming end before SAS
    },
    semester2: {
        start: new Date(2027, 0, 11), // Assuming Jan 11 start
        end: new Date(2027, 5, 25), // Assuming late June end
    },
    holidays: [
        "2026-07-01", // LAS
        "2026-07-06", // LAS
        "2026-08-17", // LN
        "2026-08-25", // LN
        "2026-08-28", // PHBI
        "2026-12-24", // LN
        "2026-12-25", // PHBI
        "2026-12-28", // LN
        "2027-01-01", // LN
        "2027-01-04", // LN
        "2027-02-07", // LN
        "2027-02-08", // LAR
        "2027-03-08", // LN
        "2027-03-09", // L.IDUL FITRI
        "2027-03-26", // LN
        "2027-05-01", // LN
        "2027-05-06", // LN
        "2027-05-20", // LN
        "2027-06-01", // LN
        "2027-06-28", // LAT
    ],
    specialDays: [
        // 2026-07-13: MPLS
        // 2026-07-20: HJP
        // 2026-08-14: HP
        // 2026-09-07: HUB
        // 2026-09-18: HBS
        // 2026-09-21: STS
        // 2026-10-01: HKP
        // 2026-10-28: HSP
        // 2026-11-10: HP
        // 2026-11-25: HUP
        // 2026-12-03: HDI
        // 2026-12-09: HAK
        // 2026-12-14: SAS
        // 2026-12-21: TPR
        // 2026-12-23: PR
        // 2027-02-17: SANLAT
        // 2027-02-22: SANLAT
        // 2027-02-29: SANLAT
        // 2027-03-01: SANLAT
        // 2027-03-04: SIMULASI
        // 2027-03-22: HAS
        // 2027-04-22: HB
        // 2027-04-23: HBS
        // 2027-04-26: TKA SUSULAN
        // 2027-05-10: ASAJ
        // 2027-05-17: IA
        // 2027-05-24: OSN
        // 2027-06-05: HLH
        // 2027-06-07: ASAT
    ]
};
