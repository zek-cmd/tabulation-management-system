import React, { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { useRealtimeData } from "@/lib/useRealtimeData";
import { genderKey, GENDER_GROUP_LABELS, GENDER_ORDER } from "@/lib/gender";

interface RawScore {
  contestantId: number;
  contestantName: string;
  judgeId: number;
  judgeNumber: number;
  judgeName: string;
  criteriaId: number;
  criteriaName: string;
  criteriaIdentifier: string | null;
  value: number;
}

interface Judge {
  id: number;
  name: string;
  number: number;
}

interface Contestant {
  id: number;
  name: string;
  number?: number;
  sex?: string;
  grade?: string;
}

interface FinalRankTableProps {
  eventId?: number;
  phase?: string;
  eventSettings?: {
    separateGenders: boolean;
    finalistsCount: number;
    currentPhase: string;
    hasTwoPhases: boolean;
    tieBreakingStrategy?: string;
  } | null;
}

export const FinalRankTable: React.FC<FinalRankTableProps> = ({ eventId, phase = "PRELIMINARY", eventSettings }) => {
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<RawScore[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [criteria, setCriteria] = useState<{ id: number; parentId?: number | null }[]>([]);
  // Grows whenever a judge saves scores -> refetch below
  const realtimeVersion = useRealtimeData(eventId);

  useEffect(() => {
    const url = eventId ? `/api/raw-scores?eventId=${eventId}&phase=${phase}` : `/api/raw-scores?phase=${phase}`;
    fetch(getApiUrl(url))
      .then((res) => res.json())
      .then((data) => {
        setScores(data.scores);
        setJudges(
          data.judges
            .map((j: { id: number, name: string, number: number }) => ({ id: j.id, name: j.name, number: Number(j.number) }))
            .sort((a: Judge, b: Judge) => a.number - b.number)
        );
        setContestants(
          data.contestants
            .map((c: { id: number, name: string, number: number, sex: string, grade?: string }) => ({ id: c.id, name: c.name, number: c.number, sex: c.sex, grade: c.grade }))
        );
        setCriteria(data.criteria);
        setLoading(false);
      });
  }, [eventId, phase, realtimeVersion]);

  if (loading) return <div className="py-8 text-center">Loading...</div>;

  // Function to calculate rankings for a group of contestants
  const calculateRankings = (contestantGroup: Contestant[], scoreGroup: RawScore[], judgeGroup: Judge[], criteriaGroup: { id: number; parentId?: number | null }[]) => {
    // Only use sub-criteria (criteria with parentId)
    const subCriteriaIds = criteriaGroup.filter((c) => c.parentId).map((c) => c.id);

    // For each judge and contestant, sum all sub-criteria scores
    const judgeScores: Record<number, { contestantId: number; value: number }[]> = {};
    judgeGroup.forEach((judge) => {
      judgeScores[judge.id] = contestantGroup.map((c) => {
        const total = scoreGroup
          .filter((s) => s.judgeId === judge.id && s.contestantId === c.id && subCriteriaIds.includes(s.criteriaId))
          .reduce((sum, s) => sum + s.value, 0);
        return { contestantId: c.id, value: total };
      });
    });

    // For each judge, compute ranks (dense ranking)
    const judgeRanks: Record<number, Record<number, number>> = {};
    judgeGroup.forEach((judge) => {
      const arr = [...judgeScores[judge.id]];
      arr.sort((a, b) => b.value - a.value);
      let rank = 1;
      for (let i = 0; i < arr.length; ) {
        const tieValue = arr[i].value;
        let tieEnd = i;
        while (tieEnd + 1 < arr.length && arr[tieEnd + 1].value === tieValue) {
          tieEnd++;
        }
        for (let j = i; j <= tieEnd; j++) {
          if (!judgeRanks[judge.id]) judgeRanks[judge.id] = {};
          judgeRanks[judge.id][arr[j].contestantId] = rank;
        }
        rank += (tieEnd - i + 1);
        i = tieEnd + 1;
      }
    });

    // For each contestant, sum their ranks and total scores across all judges
    type RankingRow = {
      contestant: Contestant;
      ranks: number[];
      totalRank: number;
      totalScore: number;
      finalRank?: number;
    };
    const contestantRows: RankingRow[] = contestantGroup.map((c) => {
      const ranks = judgeGroup.map((j) => judgeRanks[j.id]?.[c.id] ?? "");
      const totalRank = ranks.reduce((sum, r) => sum + (typeof r === "number" ? r : 0), 0);
      // Sum all sub-criteria scores for this contestant (all judges)
      const totalScore = scoreGroup
        .filter((s) => s.contestantId === c.id && subCriteriaIds.includes(s.criteriaId))
        .reduce((sum, s) => sum + s.value, 0);
      return {
        contestant: c,
        ranks,
        totalRank,
        totalScore,
      };
    });

    // Sort by totalRank ascending
    contestantRows.sort((a, b) => a.totalRank - b.totalRank);

    // Assign final rank (dense ranking, ties share the same rank)
    let prevRank = 1;
    let prevTotalRank: number | null = null;
    contestantRows.forEach((row, idx) => {
      if (prevTotalRank !== null && row.totalRank === prevTotalRank) {
        row.finalRank = prevRank;
      } else {
        row.finalRank = idx + 1;
        prevRank = idx + 1;
      }
      prevTotalRank = row.totalRank;
    });

    return contestantRows;
  };

  // Function to get eligible contestants for the current phase
  const getEligibleContestants = (allContestants: Contestant[], targetPhase: string) => {
    // If contest has only one phase, all contestants are eligible
    if (!eventSettings?.hasTwoPhases) {
      return allContestants;
    }

    if (targetPhase === "PRELIMINARY") {
      return allContestants;
    }

    // For FINAL phase, only include contestants who actually have final scores
    // This follows the "back to zero" scoring principle where only finalists are scored in final phase
    const contestantsWithFinalScores = new Set(scores.map(s => s.contestantId));
    return allContestants.filter(c => contestantsWithFinalScores.has(c.id));
  };

  // Get eligible contestants for this phase
  const eligibleContestants = getEligibleContestants(contestants, phase);
  const eligibleContestantIds = new Set(eligibleContestants.map(c => c.id));
  
  // Filter scores to only include eligible contestants
  const filteredScores = scores.filter(s => eligibleContestantIds.has(s.contestantId));
  
  // Calculate rankings
  let rankings;
  let genderRankings: Map<string, ReturnType<typeof calculateRankings>> | null = null;
  
  if (eventSettings?.separateGenders) {
    // Separate rankings by gender (Male, Female, Mix, then unset/other)
    genderRankings = new Map();
    for (const key of GENDER_ORDER) {
      const groupContestants = eligibleContestants.filter(c => genderKey(c.sex) === key);
      const groupScores = filteredScores.filter(s => groupContestants.some(gc => gc.id === s.contestantId));
      genderRankings.set(key, calculateRankings(groupContestants, groupScores, judges, criteria));
    }
    rankings = null; // We'll render separate tables
  } else {
    // Unified rankings
    rankings = calculateRankings(eligibleContestants, filteredScores, judges, criteria);
    genderRankings = null;
  }

  // Helper function to render ordinal rank
  const getOrdinalRank = (rank: number): string => {
    if (rank === 1) return "1st";
    if (rank === 2) return "2nd";
    if (rank === 3) return "3rd";
    return `${rank}th`;
  };

  // Helper function to render a ranking table
  const renderRankingTable = (rankingData: typeof rankings, title?: string) => (
    <div className="mb-6">
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">No.</th>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Total Score</th>
              <th className="border px-2 py-1">Total Rank</th>
              <th className="border px-2 py-1">Final Rank</th>
            </tr>
          </thead>
          <tbody>
            {rankingData!.map((row, idx) => {
              let rowClass = "";
              // Highlight top 3
              if (row.finalRank === 1) rowClass = "bg-yellow-100 font-bold";
              else if (row.finalRank === 2) rowClass = "bg-gray-200 font-semibold";
              else if (row.finalRank === 3) rowClass = "bg-orange-100 font-semibold";
              return (
                <tr key={row.contestant.id} className={rowClass}>
                  <td className="border px-2 py-1 text-center">{row.contestant.number || idx + 1}</td>
                  <td className="border px-2 py-1 text-sm leading-snug">
                    {row.contestant.name}
                    {row.contestant.grade && (
                      <div className="text-xs leading-snug text-gray-500 italic">{row.contestant.grade}</div>
                    )}
                  </td>
                  <td className="border px-2 py-1 text-center font-bold">{row.totalScore.toFixed(2)}</td>
                  <td className="border px-2 py-1 text-center font-bold">{row.totalRank}</td>
                  <td className="border px-2 py-1 text-center font-bold">{getOrdinalRank(row.finalRank!)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      {eventSettings?.separateGenders ? (
        <>
          {GENDER_ORDER.map(key => {
            const rows = genderRankings?.get(key);
            if (!rows || rows.length === 0) return null;
            return <React.Fragment key={key}>{renderRankingTable(rows, GENDER_GROUP_LABELS[key])}</React.Fragment>;
          })}
        </>
      ) : (
        renderRankingTable(rankings)
      )}
    </div>
  );
};