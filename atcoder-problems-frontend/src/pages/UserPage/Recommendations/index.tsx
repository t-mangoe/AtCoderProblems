import React, { useState } from "react";
import {
  BootstrapTable,
  SelectRowMode,
  TableHeaderColumn,
} from "react-bootstrap-table";
import { useHistory } from "react-router-dom";
import { Button, ButtonGroup, Row } from "reactstrap";
import {
  useContestMap,
  useMergedProblemMap,
  useProblemModelMap,
  useRatingInfo,
  useUserSubmission,
} from "../../../api/APIClient";
import { useLoginState } from "../../../api/InternalAPIClient";
import { ContestLink } from "../../../components/ContestLink";
import { HelpBadgeTooltip } from "../../../components/HelpBadgeTooltip";
import { NewTabLink } from "../../../components/NewTabLink";
import { ProblemLink } from "../../../components/ProblemLink";
import Problem from "../../../interfaces/Problem";
import { ProblemId } from "../../../interfaces/Status";
import Submission from "../../../interfaces/Submission";
import { isAccepted } from "../../../utils";
import {
  formatPredictedSolveProbability,
  formatPredictedSolveTime,
} from "../../../utils/ProblemModelUtil";
import { PROBLEM_ID_SEPARATE_SYMBOL } from "../../../utils/QueryString";
import * as Url from "../../../utils/Url";
import * as UserState from "../../../utils/UserState";
import { useLocalStorage } from "../../../utils/LocalStorage";
import { recommendProblems } from "./RecommendProblems";
import {
  ExcludeOption,
  RecommendController,
  RecommendOption,
} from "./RecommendController";

const isIncluded = (
  problemId: string,
  excludeOption: ExcludeOption,
  currentSecond: number,
  lastSolvedTimeMap: Map<ProblemId, number>,
  submittedProblemIds: Set<ProblemId>
): boolean => {
  const lastSolvedTime = lastSolvedTimeMap.get(problemId);
  if (lastSolvedTime) {
    const seconds = currentSecond - lastSolvedTime;
    switch (excludeOption) {
      case "Exclude":
      case "Exclude submitted":
        return false;
      case "1 Week":
        return seconds > 3600 * 24 * 7;
      case "2 Weeks":
        return seconds > 3600 * 24 * 14;
      case "4 Weeks":
        return seconds > 3600 * 24 * 28;
      case "6 Months":
        return seconds > 3600 * 24 * 180;
      case "Don't exclude":
        return true;
    }
  }

  const isSubmitted = submittedProblemIds.has(problemId);
  if (excludeOption === "Exclude submitted") {
    return !isSubmitted;
  }
  return true;
};

const getLastSolvedTimeMap = (userSubmissions: Submission[]) => {
  const lastSolvedTimeMap = new Map<ProblemId, number>();
  userSubmissions
    .filter((s) => isAccepted(s.result))
    .forEach((s) => {
      const cur = lastSolvedTimeMap.get(s.problem_id) ?? 0;
      lastSolvedTimeMap.set(s.problem_id, Math.max(s.epoch_second, cur));
    });
  return lastSolvedTimeMap;
};

interface Props {
  userId: string;
}

export const Recommendations = (props: Props) => {
  const history = useHistory();
  const loginState = useLoginState().data;
  const userSubmissions = useUserSubmission(props.userId) ?? [];

  const [recommendOption, setRecommendOption] = useLocalStorage<
    RecommendOption
  >("recommendOption", "Moderate");
  const [recommendExperimental, setRecommendExperimental] = useLocalStorage<
    boolean
  >("recommendExperimental", true);
  const [excludeOption, setExcludeOption] = useLocalStorage<ExcludeOption>(
    "recoomendExcludeOption",
    "Exclude"
  );

  const userRatingInfo = useRatingInfo(props.userId);
  const [recommendNum, setRecommendNum] = useState(10);
  const [selectedProblemIdSet, setSelectedProblemIdSet] = useState<
    Set<ProblemId>
  >(new Set());

  const selectProblemIds = (ids: ProblemId[]) => {
    const newSet = new Set<ProblemId>(selectedProblemIdSet);
    ids.forEach((problemId) => newSet.add(problemId));
    setSelectedProblemIdSet(newSet);
  };

  const deselectProblemIds = (ids: ProblemId[]) => {
    const newSet = new Set<ProblemId>(selectedProblemIdSet);
    ids.forEach((problemId) => newSet.delete(problemId));
    setSelectedProblemIdSet(newSet);
  };
  const { data: mergedProblemsMap } = useMergedProblemMap();
  const problems = mergedProblemsMap
    ? Array.from(mergedProblemsMap.values())
    : [];
  const contestMap = useContestMap();
  const problemModels = useProblemModelMap();
  const isLoggedIn = UserState.isLoggedIn(loginState);

  if (userSubmissions.length === 0) {
    return null;
  }

  const lastSolvedTimeMap = getLastSolvedTimeMap(userSubmissions);
  const submittedSet = new Set(userSubmissions.map((s) => s.problem_id));
  const currentSecond = Math.floor(new Date().getTime() / 1000);

  const filteredRecommendedProblems = recommendProblems(
    problems,
    (problemId: ProblemId) =>
      isIncluded(
        problemId,
        excludeOption,
        currentSecond,
        lastSolvedTimeMap,
        submittedSet
      ),
    (problemId: ProblemId) => problemModels?.get(problemId),
    recommendExperimental,
    userRatingInfo.internalRating,
    recommendOption,
    recommendNum
  );

  const selectedProblemIds = Array.from(selectedProblemIdSet);
  interface HasProblemId {
    id: ProblemId;
  }
  const selectRowProps = !isLoggedIn
    ? undefined
    : {
        mode: "checkbox" as SelectRowMode,
        selected: selectedProblemIds,
        onSelect: (row: HasProblemId, isSelected: boolean) => {
          if (isSelected) {
            selectProblemIds([row.id]);
          } else {
            deselectProblemIds([row.id]);
          }
        },
        onSelectAll: (isSelected: boolean, rows: HasProblemId[]) => {
          const ids = rows.map(({ id }) => id);
          if (isSelected) {
            selectProblemIds(ids);
          } else {
            deselectProblemIds(ids);
          }
          return Array.from(selectedProblemIdSet);
        },
      };
  const problemIdToString = selectedProblemIds.join(PROBLEM_ID_SEPARATE_SYMBOL);
  const createContestLocation = {
    pathname: "/contest/create",
    search: !problemIdToString ? "" : "?problemIds=" + problemIdToString,
  };

  return (
    <>
      <Row className="my-3 d-flex justify-content-between">
        <RecommendController
          recommendOption={recommendOption}
          onChangeRecommendOption={(option) => setRecommendOption(option)}
          excludeOption={excludeOption}
          onChangeExcludeOption={(option) => setExcludeOption(option)}
          showExperimental={recommendExperimental}
          onChangeExperimentalVisibility={(show) =>
            setRecommendExperimental(show)
          }
          showCount={recommendNum}
          onChangeShowCount={(value) => setRecommendNum(value)}
        />
      </Row>
      {isLoggedIn && (
        <Row>
          <ButtonGroup>
            <Button
              color="success"
              disabled={selectedProblemIdSet.size == 0}
              onClick={() => {
                history.push(createContestLocation);
              }}
            >
              Create Virtual Contest
            </Button>
          </ButtonGroup>
        </Row>
      )}
      <Row className="my-3">
        <BootstrapTable
          data={filteredRecommendedProblems}
          keyField="id"
          height="auto"
          hover
          striped
          selectRow={selectRowProps}
        >
          <TableHeaderColumn
            dataField="title"
            dataFormat={(
              title: string,
              {
                id,
                contest_id,
                is_experimental,
              }: { id: string; contest_id: string; is_experimental: boolean }
            ): React.ReactElement => (
              <ProblemLink
                isExperimentalDifficulty={is_experimental}
                showDifficulty={true}
                problemId={id}
                problemTitle={title}
                contestId={contest_id}
                problemModel={problemModels?.get(id) ?? null}
                userRatingInfo={userRatingInfo}
              />
            )}
          >
            Problem
          </TableHeaderColumn>
          <TableHeaderColumn
            dataField="contest_id"
            dataFormat={(
              contestId: string,
              problem: Problem
            ): React.ReactElement => {
              const contest = contestMap?.get(contestId);
              return contest ? (
                <ContestLink contest={contest} />
              ) : (
                <NewTabLink href={Url.formatContestUrl(problem.contest_id)}>
                  {contestId}
                </NewTabLink>
              );
            }}
          >
            Contest
          </TableHeaderColumn>
          <TableHeaderColumn
            dataField="difficulty"
            dataFormat={(difficulty: number | null): string => {
              if (difficulty === null) {
                return "-";
              }
              return String(difficulty);
            }}
          >
            <span>Difficulty</span>
            &nbsp;
            <HelpBadgeTooltip id="difficulty">
              Internal rating to have 50% Solve Probability
            </HelpBadgeTooltip>
          </TableHeaderColumn>
          <TableHeaderColumn
            dataField="predictedSolveProbability"
            dataFormat={formatPredictedSolveProbability}
          >
            <span>Solve Probability</span>
            &nbsp;
            <HelpBadgeTooltip id="probability">
              Estimated probability that you could solve this problem if you
              competed in the contest.
            </HelpBadgeTooltip>
          </TableHeaderColumn>
          <TableHeaderColumn
            dataField="predictedSolveTime"
            dataFormat={formatPredictedSolveTime}
          >
            <span>Median Solve Time</span>
            &nbsp;
            <HelpBadgeTooltip id="solvetime">
              Estimated time required to solve this problem.
            </HelpBadgeTooltip>
          </TableHeaderColumn>
        </BootstrapTable>
      </Row>
    </>
  );
};
