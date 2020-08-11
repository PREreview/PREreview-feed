const fetch = require('node-fetch')
const fs = require('fs')
const builder = require('xmlbuilder')

const REVIEWS_API_URL =
  'https://outbreaksci.prereview.org/api/action?q=@type:RapidPREreviewAction&include_docs=true';

const USERS_API_URL = 'https://outbreaksci.prereview.org/api/role?q=*:*&include_docs=true';

const getReviews = async (bookmark) => {
  let url = REVIEWS_API_URL 

  if (bookmark) {
    url = url + `&bookmark=${bookmark}`
  }

  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    console.log('oh dear, looks like we broke the reviews fetch: ', error)
  }
}

const getUsers = async (bookmark) => {
  let url = USERS_API_URL 

  if (bookmark) {
    url = url + `&bookmark=${bookmark}`
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
   let { rows, bookmark } = await getReviews(prevBookmark)
   prevBookmark = bookmark
   prevRows = rows
   results = results.concat(rows)
  }
  while (prevRows.length > 0)

  return results
}

const getAllRoles = async () => {
  let prevBookmark = null;
  let results = [];
  let prevRows = [];

  do {
    let { rows, bookmark } = await getUsers(prevBookmark)
    prevBookmark = bookmark
    prevRows = rows
    results = results.concat(rows)
  }
  while (prevRows.length > 0)

  return results
}

const main = async () => {
  const roles = await getAllRoles()
  const rolesMap = roles.reduce((rolesMap, role)=>{
     rolesMap.set(role.id, role.doc['@type'] === 'AnonymousReviewerRole' ? 'Anonymous' : role.doc.name)
     return rolesMap
  }, new Map())

  const allReviews = await getAllReviews()

  const cleaned = allReviews.map(review => {
    return {
      preprintId: review.doc.object.doi ? review.doc.object.doi : review.doc.object.arXivId,
      idType: review.doc.object.doi ? 'DOI' : 'arXivId',
      reviewer: rolesMap.get(review.doc.agent), 
      dateReviewed: review.doc.startTime,
      reviewLink: `https://outbreaksci.prereview.org/${review.doc.object.doi ? review.doc.object.doi : review.doc.object.arXivId}?role=${review.doc.agent.split(':')[1]}`
    }
  })

  let reviews = JSON.stringify(cleaned)
  fs.writeFile('reviews.txt', reviews, (error) => {
    if (error) throw error;
    console.log('The reviews has been saved to a file called reviews.txt');
  })
  
}

main()