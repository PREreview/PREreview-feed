const fetch = require('node-fetch');
const fs = require('fs');
const { create } = require('xmlbuilder2');
const Feed = require('feed').Feed;

const REVIEWS_API_URL =
  'https://outbreaksci.prereview.org/api/action?q=@type:RapidPREreviewAction&include_docs=true';

const USERS_API_URL =
  'https://outbreaksci.prereview.org/api/role?q=*:*&include_docs=true';

// only fetches preprints with reviews
const PREPRINTS_API_URL = 'https://outbreaksci.prereview.org/api/preprint?';
const REVIEWED_PREPRINTS_QUERY =
  'q=nReviews%3A[1+TO+Infinity]&sort=[%22-score%3Cnumber%3E%22%2C%22-datePosted%3Cnumber%3E%22%2C%22-dateLastActivity%3Cnumber%3E%22]&include_docs=true&counts=[%22hasPeerRec%22%2C%22hasOthersRec%22%2C%22hasData%22%2C%22hasCode%22%2C%22hasReviews%22%2C%22hasRequests%22%2C%22subjectName%22]&ranges={%22nReviews%22%3A{%220%22%3A%22[0+TO+1}%22%2C%221%2B%22%3A%22[1+TO+Infinity]%22%2C%222%2B%22%3A%22[2+TO+Infinity]%22%2C%223%2B%22%3A%22[3+TO+Infinity]%22%2C%224%2B%22%3A%22[4+TO+Infinity]%22%2C%225%2B%22%3A%22[5+TO+Infinity]%22}%2C%22nRequests%22%3A{%220%22%3A%22[0+TO+1}%22%2C%221%2B%22%3A%22[1+TO+Infinity]%22%2C%222%2B%22%3A%22[2+TO+Infinity]%22%2C%223%2B%22%3A%22[3+TO+Infinity]%22%2C%224%2B%22%3A%22[4+TO+Infinity]%22%2C%225%2B%22%3A%22[5+TO+Infinity]%22}}';

const getReviews = async (bookmark) => {
  let url = REVIEWS_API_URL;

  if (bookmark) {
    url = url + `&bookmark=${bookmark}`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.log('oh dear, looks like we broke the reviews fetch: ', error);
  }
};

const getUsers = async (bookmark) => {
  let url = USERS_API_URL;

  if (bookmark) {
    url = url + `&bookmark=${bookmark}`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.log('oh dear, looks like we broke the users fetch: ', error);
  }
};

const getPreprints = async (bookmark) => {
  let url = PREPRINTS_API_URL + REVIEWED_PREPRINTS_QUERY;

  if (bookmark) {
    url =
      PREPRINTS_API_URL +
      `bookmark=${bookmark}` +
      `&${REVIEWED_PREPRINTS_QUERY}`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.log('oh dear, looks like we broke the users fetch: ', error);
  }
};

const getAllReviews = async () => {
  let prevBookmark = null;
  let results = [];
  let prevRows = [];

  do {
    let { rows, bookmark } = await getReviews(prevBookmark);
    prevBookmark = bookmark;
    prevRows = rows;
    results = results.concat(rows);
  } while (prevRows.length > 0);

  return results;
};

const getAllRoles = async () => {
  let prevBookmark = null;
  let results = [];
  let prevRows = [];

  do {
    let { rows, bookmark } = await getUsers(prevBookmark);
    prevBookmark = bookmark;
    prevRows = rows;
    results = results.concat(rows);
  } while (prevRows.length > 0);

  return results;
};

const getAllPreprints = async () => {
  let prevBookmark = null;
  let results = [];
  let prevRows = [];

  do {
    let { rows, bookmark } = await getPreprints(prevBookmark);
    prevBookmark = bookmark;
    prevRows = rows;
    results = results.concat(rows);
  } while (prevRows.length > 0);

  return results;
};

const main = async () => {
  const roles = await getAllRoles();
  const rolesMap = roles.reduce((rolesMap, role) => {
    rolesMap.set(
      role.id,
      role.doc['@type'] === 'AnonymousReviewerRole'
        ? 'Anonymous'
        : role.doc.name,
    );
    return rolesMap;
  }, new Map());

  const allReviews = await getAllReviews();

  const cleaned = allReviews.map((review) => {
    return {
      preprintId: review.doc.object.doi
        ? review.doc.object.doi
        : review.doc.object.arXivId,
      preprintTitle: review.doc.object.name,
      idType: review.doc.object.doi ? 'DOI' : 'arXivId',
      reviewer: rolesMap.get(review.doc.agent),
      dateReviewed: new Date(review.doc.startTime),
      reviewLink: `https://outbreaksci.prereview.org/${
        review.doc.object.doi
          ? review.doc.object.doi
          : review.doc.object.arXivId
      }?role=${review.doc.agent.split(':')[1]}`,
    };
  });

  const sorted = cleaned.sort((a, b) => b.dateReviewed - a.dateReviewed);

  const reviews = JSON.stringify(sorted, null, 2);

  fs.writeFile('reviews.json', reviews, (error) => {
    if (error) throw error;
    console.log('A JSON file of all reviews has been saved to reviews.json!');
  });

  return sorted;
};

const buildFeed = async () => {
  const reviews = await main();

  const withDOI = reviews.filter((review) => review.idType === 'DOI');

  const feed = new Feed({
    title: 'OutbreakScience Rapid PREreview',
    description:
      'Rapid reviews of preprints posted on OutbreakScience Rapid PREreview',
    link: 'https://outbreaksci.prereview.org/',
    copyright: 'OutbreakScience Rapid PREreview',
    author: {
      name: 'Outbreak Science Rapid PREreview',
      email: 'outbreaksci@prereview.org',
      link: 'https://outbreaksci.prereview.org/',
    },
  });

  withDOI.forEach((review) => {
    feed.addItem({
      title: 'A rapid review of ' + `${review.preprintTitle} by ${review.reviewer}` ,
      preprintDOI: review.preprintId, 
      link: review.reviewLink,
      date: review.dateReviewed,
    });
  });

  fs.writeFile('rss.xml', feed.rss2(), (error) => {
    if (error) throw error;
    console.log(
      'An RSS feed of all reviews has been saved to a file called rss.xml!',
    );
  });
};

console.log(
  'Downloading all reviews of preprints with DOIs on Outbreak Science Rapid PREreview...',
);

buildFeed();

const processPreprints = async () => {
  const hasReviews = await getAllPreprints();
  const withDOI = hasReviews.filter((preprint) => !!preprint.doc.doi);

  const processed = withDOI.map((preprint) => {
    return {
      title: preprint.doc.name,
      doi: preprint.doc.doi,
      link: `https://outbreaksci.prereview.org/${preprint.doc.doi}`,
    };
  });

  return processed;
};

const buildXML = async () => {
  const preprints = await processPreprints();

  const xml = create({ version: '1.0' }).ele('links');

  for (let i = 0; i < preprints.length; i++) {
    xml
      .ele('link', { providerId: '2068' })
      .ele('resource')
      .ele('title')
      .txt(`Rapid PREreview(s) of '${preprints[i].title}'`)
      .up()
      .ele('url')
      .txt(preprints[i].link)
      .up()
      .up()
      .ele('record')
      .ele('source')
      .txt('DOI')
      .up()
      .ele('id')
      .txt(preprints[i].doi)
      .up()
      .up()
      .up();
  }

  const output = xml.end({ prettyPrint: true });

  fs.writeFile('europepmc.xml', output, (error) => {
    if (error) throw error;
    console.log(
      'An XML file of all reviews in Europe PMC LabsLink format has been saved to europepmc.xml!',
    );
  });
};

buildXML();
