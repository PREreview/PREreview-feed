const fetch = require('node-fetch');
const fs = require('fs');
const { create } = require('xmlbuilder2');
const ftp = require('basic-ftp');

let FTP_USER, FTP_PASS, FTP_HOST, FTP_DIR;
let URL = 'http://prereview2-staging.azurewebsites.net';
const TMPDIR = process.env.TMPDIR || '/tmp'
if (process.env.NODE_ENV === 'production') {
  URL = 'https://prereview.org';
  FTP_USER = process.env.FTP_USER;
  FTP_PASS = process.env.FTP_PASS;
  FTP_HOST = process.env.FTP_HOST;
  FTP_DIR = process.env.FTP_DIR;
}

// only fetches preprints with reviews
const PREPRINTS_API_URL = `${URL}/api/v2/preprints`;
const PUBLISHED_PREPRINTS_QUERY = '';

const getPreprints = async () => {
  let url = PREPRINTS_API_URL + PUBLISHED_PREPRINTS_QUERY;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.log('oh dear, looks like we broke the preprints fetch: ', error);
  }
};

const decodeHandle = (value) => {
  if (!value) {
    throw new Error('You must provide a preprintId to decode');
  }

  let scheme;
  if (value.startsWith('doi')) {
    scheme = 'doi';
  } else if (value.startsWith('arxiv')) {
    scheme = 'arxiv';
  }

  if (!scheme) {
    throw new Error(
      'String is not an encoded preprint ID (could not extract scheme)',
    );
  }

  return {
    id: `${value.split(':')[1]}`,
    scheme: scheme,
  };
};

const processPreprints = async () => {
  const hasReviews = await getPreprints();
  return hasReviews.reduce((withDOI, preprint) => {
    if (!preprint.handle) return withDOI;

    let id, scheme;
    try {
      ({ id, scheme } = decodeHandle(preprint.handle));
    } catch (err) {
      console.error('Error parsing preprint handle:', err);
      return withDOI;
    }

    // Found a DOI
    if (id && scheme === 'doi') {
      withDOI.push({
        title: preprint.title,
        doi: id,
        link: `${URL}/preprints/doi-${id.replace('/', '-')}`,
      });
    }

    return withDOI;
  }, []);
};

const buildXML = async () => {
  const preprints = await processPreprints();

  const xml = create({ version: '1.0' }).ele('links');

  for (let i = 0; i < preprints.length; i++) {
    xml
      .ele('link', { providerId: '2068' })
      .ele('resource')
      .ele('title')
      .txt(`PREreview(s) of '${preprints[i].title}'`)
      .up()
      .ele('url')
      .txt(preprints[i].link)
      .up()
      .up()
      .ele('doi')
      .txt(preprints[i].doi)
      .up()
      .up();
  }

  const output = xml.end({ prettyPrint: true });

  fs.writeFile(`${TMPDIR}/europepmc.xml`, output, (error) => {
    if (error) throw error;
    console.log(
      `An XML file of all reviews in Europe PMC LabsLink format has been saved to ${TMPDIR}/europepmc.xml!`,
    );
  });
};

const uploadToEuropePMC = async () => {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  try {
    await client.access({
      host: `${FTP_HOST}`,
      user: `${FTP_USER}`,
      password: `${FTP_PASS}`,
      secure: false,
    });
    console.log(await client.list());
    await client.cd(`${FTP_DIR}`);
    await client.uploadFrom(`${TMPDIR}/europepmc.xml`, 'links.xml');
  } catch (err) {
    console.log(err);
  }
  client.close();
};

module.exports = function(context, europepmcUpload) {
  if (europepmcUpload && europepmcUpload.IsPastDue && context) {
    context.log('Upload is running late!');
  }
  buildXML()
    .then(() => {
      if (FTP_USER && FTP_PASS) {
        uploadToEuropePMC();
      }
      return;
    })
    .catch((err) => console.error('Failed to export:', err));
  if (context) {
    if (europepmcUpload && europepmcUpload.IsPastDue) {
      context.log('Upload is running late!');
    }
    const timestamp = new Date().toISOString();
    context.log('Upload ran!', timestamp);
  }
  return;
};


