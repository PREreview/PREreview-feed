# Hi there!

This script generates files that help incorporate reviews posted on [Outbreak Science Rapid PREreviews](https://outbreaksci.prereview.org) (OSrPRE) to other preprint sites. 

The current version generates an RSS file where each item is a preprint review that has been posted to OSrPRE, sorted by date. Each review item has the following attributes: `title`, 
`preprintDOI`, `link` (a direct link to the review on OSrPRE), `reviewer` (the name of the reviewer, or 'Anonymous' if the review is posted anonymously) and `date`.

It also generates an XML file tailored specifically for [Europe PMC's external links service mechanism](https://europepmc.org/LabsLink).
To generate the files, run `npm start`. 
