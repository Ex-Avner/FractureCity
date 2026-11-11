# FractureCity Free College — first course

## Student entry

At the Mnemonic Archive, approach the central sculpture and choose **Start or resume my course**. The course also opens from **Tools → Free College** and **mobile menu → Free College**, so students do not need to traverse the world for every study session. The Archive’s former ring puzzle has been retired; its rings remain as sculpture and its signs now point to learning.

## Thinking 101

**Critical Thinking and the Art of Asking Questions** is an original, AI-assisted introductory pilot with no prerequisites. Allow roughly 3–4 hours for lessons, practice, reflection and a final investigation; actual time varies. Six units teach questions/arguments, logical inference, evidence/causation, sources, numbers/uncertainty, and disagreement/revision. Every unit includes learning objectives, four short lesson sections, a worked example, a practice question with feedback, a notebook prompt and five assessed questions. Optional further readings link directly to OpenStax pages; no textbook excerpts or third-party images are bundled. The required lessons and fictional evidence packet are shipped with the game.

The course is free to use and **non-accredited**. It has not been independently reviewed by faculty. The study guide consists of authored explanations and saved assessment feedback, not a connected LLM tutor. No model calls or subscriptions are needed. Do not advertise this pilot as an accredited college, a professionally reviewed curriculum, an adaptive AI tutor, or academic credit.

## Assessment contract

- Six unit tests: five questions each; 4/5 (80%) passes. All lessons are open from the beginning.
- Final: twelve questions applying the skills to a five-document fictional case; unlocked after passing every unit. 10/12 (83% rounded) passes.
- Tests are explicitly open-book, unproctored and repeatable. Immediate post-submission feedback explains each correct answer and shows the learner’s previous choice. Best scores and total attempt counts are preserved; the latest five attempts per assessment are retained.
- The final investigation has five writing fields, a five-item self-review rubric and the same included dossier. Recommended total length is 400–700 words. Submission requires passing all assessments, at least 80 characters in each field, at least two distinct dossier letter IDs in the evidence field, and all self-review checks.
- Those structural checks are **not an evaluation of reasoning, citation quality or writing quality**. The project is labeled student self-assessed. Different defensible conclusions are welcome.
- Completion requires every assessment pass and a submitted self-reviewed project. Changing the project or rubric returns it to draft and removes completion until resubmission. Changing ordinary unit notes does not remove completion.
- A downloadable text record states precisely what was completed, the assessment conditions, version and time. It is not a degree, verified identity record, accreditation or professional credential.

Question keys ship with the solo course. Online grading ignores client-supplied scores and calculates results server-side, but this is an open learning resource, not a cheating-resistant examination system. High-stakes assessment would need a different content distribution and review model.

## Saving and privacy

Solo progress uses `fc-college-progress-v1:device` in browser localStorage, independent of game worlds. Online progress is private to the authenticated account in SQLite `college_progress`; only that account can read/write it. It does not depend on a particular room or sentence, so learning remains available during custody. Coursework is not posted to a feed.

Typing debounces a browser draft after 400 ms. **No typing requests go to the server.** Explicit Save and navigation commit a single batch when writing changed. Assessments and final project submission are deliberate writes. A draft is retained on errors and on page hide, and portfolio export remains available. Device drafts are scoped by account so another account does not inherit them. Device storage is not encrypted; normal shared-browser precautions apply.

Revision checks reject stale writes, including between solo tabs. On conflict the learner can reload saved progress, compare the saved writing with the retained device draft and explicitly choose which writing to keep. Other unit fields and assessment results are not replaced by a draft patch. Latest attempt IDs make ordinary retries idempotent. Requests are bounded and rate-limited. Foreign keys remove coursework if its account is deleted. There is no student directory or instructor access endpoint.

## Accessibility and product behavior

The learning dialog pauses movement, releases held touch controls, traps keyboard focus, supports Escape and restores focus/pause state on close. It has labeled radio groups and textareas, touch-sized controls, scrollable mobile course navigation, readable contrast and no required audio or timed exams. Written work exports as Markdown; completion exports as plain text. Links to optional readings open separately with `noopener noreferrer`.

## Sources checked during implementation

These are optional further readings, not claims that OpenStax endorsed this course:

- Arguments: https://openstax.org/books/introduction-philosophy/pages/5-3-arguments
- Source evaluation: https://openstax.org/books/introduction-philosophy/pages/2-4-gathering-information-evaluating-sources-and-understanding-evidence
- Experimental design: https://openstax.org/books/introductory-statistics-2e/pages/1-4-experimental-design-and-ethics
- Sampling: https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling

## Verification

`_test/college.test.cjs`: content coverage, grade calculation, prerequisites, invalid answers, retry idempotency, best-score retention, project requirements, stale revisions, account isolation and persistent storage.

`_test/college-server.test.cjs`: unauthenticated rejection, private account data, HTTP scoring, stale writes, retry handling and server restart.

`_test/college-browser.test.cjs`: Archive entrance, practice feedback, private notes/XSS escaping, incomplete submissions, all six tests and final, project, completion download, 390 px phone layout, reload, revision invalidation and concurrent-tab draft recovery.

`_test/college-online-browser.test.cjs`: online touch layout, authenticated notebook, zero server writes while typing, explicit batched save and resume.

The Civic Walk regression now checks the course handoff instead of the retired puzzle. Architecture outside the Archive’s signs and activity entry is unchanged. Player save files are not part of this source update.
