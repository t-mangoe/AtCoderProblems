import { useSWRData } from "../api";
import { Course } from "../interfaces/Course";

const COURSE_PATH = "/atcoder/static_data/courses";

const loadCourse = (jsonFilename: string): Promise<Course> => {
  return fetch(`${COURSE_PATH}/${jsonFilename}`)
    .then((response) => response.json())
    .then((response) => response as Course);
};

export const useCourses = () => {
  return useSWRData("COURSES", () =>
    Promise.all([loadCourse("boot_camp_for_beginners.json")])
  );
};
