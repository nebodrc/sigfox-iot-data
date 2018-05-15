//  region Introduction
//  Cloud Function sendToDatabase is triggered when a
//  Sigfox message is sent to the message queue sigfox.types.sendToDatabase.
//  We call the Knex library to record the message in the SQL database.

/* eslint-disable max-len, camelcase, no-console, no-nested-ternary, import/no-dynamic-require, import/newline-after-import, import/no-unresolved, global-require, max-len */
//  //////////////////////////////////////////////////////////////////////////////////// endregion
//  region AutoInstall: List all dependencies here, or just paste the contents of package.json. AutoInstall will install these dependencies before calling wrap().
const package_json = /* eslint-disable quote-props,quotes,comma-dangle,indent */
//  PASTE PACKAGE.JSON BELOW  //////////////////////////////////////////////////////////
{
  "knex": "^0.13.0",
  "mysql": "^2.15.0",
  "pg": "^7.3.0",
}
//  PASTE PACKAGE.JSON ABOVE  //////////////////////////////////////////////////////////
; /* eslint-enable quote-props,quotes,comma-dangle,indent */

//  //////////////////////////////////////////////////////////////////////////////////// endregion
//  region Declarations: Don't use any require() or process.env in this section because AutoInstall has not loaded our dependencies yet.

//  Our database settings are stored in the Google Cloud Metadata store under this prefix.
//  If there are multiple instances of this function e.g. sendToDatabase2, sendToDatabase3, ...
//  we will add a instance suffix e.g. sigfox-dbclient2, sigfox-dbclient3, ...
const metadataPrefix = 'sigfox-db';
const metadataKeys = {   //  Keys we use and their default values, before prepending metadataPrefix.
  client: null,          //  Database client to be used e.g mysql. Must be installed from npm.
  host: null,            //  Address of database server e.g. 127.0.0.1
  user: 'user',          //  User ID for accessing the database e.g. user
  password: null,        //  Password for accessing the database.
  name: 'sigfox',        //  Name of the database, e.g. sigfox
  table: 'sensordata',   //  Name of the table to store sensor data e.g. sensordata
  version: null,         //  Version number of database, used only by Postgres e.g. 7.2
  id: 'uuid',            //  Name of the ID field in the table, e.g. uuid
};

//  Default fields to be created in sensordata table. Format: fieldname, indexed?, comment
const sensorfields = (tbl) => ({
  uuid: [tbl.uuid, false, 'Primary key: Unique message ID in UUID format, e.g. 4cf3ad36-3d3e-415c-a25b-9f8ab2bb4466'],
  timestamp: [tbl.timestamp, true, 'Timestamp of message receipt at basestation., e.g. 1507798768000'],
  localdatetime: [tbl.string, false, 'Human-readable local datetime, e.g. 2017-10-12 08:59:29'],

  alt: [tbl.float, false, 'Altitude in metres above sea level, used by send-alt-structured demo, e.g. 86.4'],
  avgSnr: [tbl.float, false, 'Sigfox average signal-to-noise ratio, e.g. 59.84'],
  baseStationLat: [tbl.float, false, 'Sigfox basestation latitude.  Usually truncated to 0 decimal points, e.g. 1'],
  baseStationLng: [tbl.float, false, 'Sigfox basestation longitude.  Usually truncated to 0 decimal points, e.g. 104'],
  baseStationTime: [tbl.integer, false, 'Sigfox timestamp of message receipt at basestation, in seconds since epoch (1/1/1970), e.g. 1507798768'],
  // callbackTimestamp: [f => tbl.timestamp.bind(tbl)(f).defaultTo(knex.fn.now()), false, 'Timestamp at which sigfoxCallback was called, e.g. 1507798769710'],
  data: [tbl.string, false, 'Sigfox message data, e.g. b0510001a421f90194056003'],
  datetime: [tbl.string, false, 'Human-readable UTC datetime, e.g. 2017-10-12 08:59:29'],
  device: [tbl.string, true, 'Sigfox device ID, e.g. 2C1C85'],
  deviceLat: [tbl.float, false, 'Latitude of GPS tracker e.g. UnaTumbler.'],
  deviceLng: [tbl.float, false, 'Longitude of GPS tracker e.g. UnaTumbler.'],
  duplicate: [tbl.boolean, true, 'Sigfox sets to false if this is the first message received among all basestations.'],
  geolocLat: [tbl.float, false, 'Sigfox Geolocation latitude of device.'],
  geolocLng: [tbl.float, false, 'Sigfox Geolocation longitude of device.'],
  geolocLocationAccuracy: [tbl.float, false, 'Sigfox Geolocation accuracy of device.'],
  hmd: [tbl.float, false, '% Humidity, used by send-alt-structured demo, e.g. 50.5'],
  lat: [tbl.float, false, 'Latitude for rendering in Ubidots.'],
  lng: [tbl.float, false, 'Longitude for rendering in Ubidots.'],
  rssi: [tbl.float, true, 'Sigfox signal strength, e.g. -122'],
  seqNumber: [tbl.integer, true, 'Sigfox message sequence number, e.g. 2426'],
  snr: [tbl.float, false, 'Sigfox message signal-to-noise ratio, e.g. 21.61'],
  station: [tbl.string, true, 'Sigfox basestation ID, e.g. 2464'],
  station2: [tbl.string, true, 'Sigfox basestation ID, e.g. 2464'],
  tmp: [tbl.float, false, 'Temperature in degrees Celsius, used by send-alt-structured demo, e.g. 25.6'],
});

let db = null;  //  Instance of the Knex library.
let tableInfo = null;  //  Contains the actual columns in the sensordata table.
let getMetadataConfigPromise = null;  //  Promise for returning the metadata config.
let getDatabaseConfigPromise = null;  //  Promise for returning the database connection.
let reuseCount = 0;

//  //////////////////////////////////////////////////////////////////////////////////// endregion
//  region Message Processing Code

function wrap(scloud) {  //  scloud will be either sigfox-gcloud or sigfox-aws, depending on platform.
  //  Wrap the module into a function so that all we defer loading of dependencies,
  //  and ensure that cloud resources are properly disposed. For AWS, wrap() is called after
  //  all dependencies have been loaded.
  let wrapCount = 0; //  Count how many times the wrapper was reused.

  //  List all require() here because AutoInstall has loaded our dependencies. Don't include sigfox-gcloud or sigfox-aws, they are added by AutoInstall.
  //  We use Knex library to support many types of databases.
  //  Remember to install any needed database clients e.g. "mysql", "pg"
  const knex = require('knex');

  function getInstance(name) {
    //  Given a function name like "func123", return the suffix number "123".
    let num = '';
    //  Walk backwards from the last char. Stop when we find a non-digit.
    for (let i = name.length - 1; i >= 0; i -= 1) {
      const ch = name[i];
      if (ch < '0' || ch > '9') break;
      num = ch + num;
    }
    return num;
  }

  function getMetadataConfig(req, metadataPrefix0, metadataKeys0, instance0) {
    //  Fetch the metadata config from the Google Cloud Metadata store or AWS Lambda
    //  Environment Variables.  metadataPrefix is the common prefix for all config keys,
    //  e.g. "sigfox-db".  metadataKeys is a map of the key suffix and the default values.
    //  Returns a promise for the map of metadataKeys to values.
    //  We use the Google Cloud Metadata store because it has an editing screen and is easier
    //  to deploy, compared to a config file. instance0 is used for unit test.
    if (getMetadataConfigPromise) return getMetadataConfigPromise;  //  Return the cache.
    //  Find the instance number based on the function name
    //  e.g. sendToDatabase123 will be instance 123. Then we will get metadata
    //  sigfox-dbclient123, ....
    const instance = instance0 || (
      scloud.functionName ? getInstance(scloud.functionName) : ''
    );
    scloud.log(req, 'getMetadataConfig', { metadataPrefix0, metadataKeys0, instance });
    //  Get the function metadata from environment or Google Metadata Store.
    getMetadataConfigPromise = scloud.authorizeFunctionMetadata(req)
      .then(authClient => scloud.getFunctionMetadata(req, authClient))
      .then((metadata) => {
        //  Hunt for the metadata keys in the metadata object and copy them.
        const config = Object.assign({}, metadataKeys0);
        scloud.log(req, 'getMetadataConfig', { status: 'finding_keys', keys: Object.keys(config).map(k => (metadataPrefix0 + k + instance)) });
        for (const configKey of Object.keys(config)) {
          const metadataKey = metadataPrefix0 + configKey + instance;
          if (metadata[metadataKey] !== null && metadata[metadataKey] !== undefined) {
            //  Copy the non-null values.
            config[configKey] = metadata[metadataKey];
          }
        }
        const result = config;
        scloud.log(req, 'getMetadataConfig', { result, metadataPrefix0, metadataKeys0, instance });
        return result;
      })
      .catch((error) => {
        scloud.log(req, 'getMetadataConfig', { error, metadataPrefix0, metadataKeys0, instance });
        throw error;
      });
    return getMetadataConfigPromise;
  }

  function getDatabaseConfig(req, reload, instance) {
    //  Return the database connection config from the Google Cloud Metadata store.
    //  Set the global db with the Knex object and tableInfo with the sensor table info.
    //  Return the cached connection unless reload is true.  instance is used for unit test.
    //  Returns a promise.
    let metadata = null;
    let dbconfig = null;
    if (getDatabaseConfigPromise && !reload) {
      reuseCount += 1; wrapCount += 1;
      return getDatabaseConfigPromise;
    }
    reuseCount = 0; wrapCount = 0;
    getDatabaseConfigPromise = getMetadataConfig(req,
      metadataPrefix, metadataKeys, instance)
      .then((res) => { metadata = res; })
      .then(() => {
        dbconfig = {
          client: metadata.client,
          connection: {
            host: metadata.host,
            user: metadata.user,
            password: metadata.password,
            database: metadata.name,
          },
        };
        //  Set the version for Postgres.
        if (metadata.version) dbconfig.version = metadata.version;
        //  Create the Knex instance for accessing the database.
        db = knex(dbconfig);
      })
      //  Read the column info for the sensordata table.
      .then(() => db(metadata.table).columnInfo())
      .then((res) => { tableInfo = res; })
      .then(() => dbconfig)
      .catch((error) => {
        scloud.log(req, 'getDatabaseConfig', { error });
        throw error;
      });
    return getDatabaseConfigPromise;
  }

  function throwError(err) {
    throw err;
  }

  function createTable(req) {
    //  Create the sensordata table if it doesn't exist.  Returns a promise.
    let table = null;
    let id = null;
    let metadata = null;
    let result = null;
    return Promise.all([
      getDatabaseConfig(req).catch(throwError),
      getMetadataConfig(req).then((res) => { metadata = res; }).catch(throwError),
    ])
      .then(() => {
        table = metadata.table;
        id = metadata.id;
        scloud.log(req, 'createTable', { table, id });
        return db.schema.createTableIfNotExists(table, (tbl) => {
          //  Create each field found in sensorfields.
          const fields = sensorfields(tbl);
          for (const fieldName of Object.keys(fields)) {
            const field = fields[fieldName];
            const fieldTypeFunc = field[0];
            const fieldIndex = field[1];
            const fieldComment = field[2];
            if (!fieldTypeFunc) {
              const error = new Error(`Unknown field type for ${fieldName}`);
              scloud.error(req, 'createTable', { error });
              continue;
            }
            //  Invoke the column builder function.
            const col = fieldTypeFunc.bind(tbl)(fieldName);
            col.comment(fieldComment);
            //  If id field, set as primary field.
            if (fieldName === id) col.primary();
            if (fieldIndex) col.index();
          }
          //  Add the created_at and updated_at fields.
          tbl.timestamps(true, true);
        });
      })
      .then((res) => {
        result = res;
        scloud.log(req, 'createTable', { result, table, id });
      })
      //  Reload the table info.
      .then(() => getDatabaseConfig(req, true))
      .then(() => result)
      .catch((error) => {
        scloud.error(req, 'createTable', { error, table, id });
        throw error;
      });
  }

  function task(req, device, body0, msg) {
    //  Handle the Sigfox received by adding it to the sensordata table.
    //  Database connection settings are read from Google Compute Metadata or
    //  environment variables.  If the sensordata table is missing, it will be created.
    let metadata = null;
    let table = null;
    let result = null;
    const body = Object.assign({}, body0);
    //  Create the Knex database connection or return from cache.
    return Promise.all([
      getDatabaseConfig(req).catch(throwError),
      getMetadataConfig(req).then((res) => { metadata = res; }).catch(throwError),
    ])
      .then(() => {
        //  Create the sensordata table if it doesn't exist.
        if (tableInfo && Object.keys(tableInfo).length > 0) return 'OK';
        return createTable(req);
      })
      .then(() => {
        //  Create the record by calling Knex library.
        table = metadata.table;
        //  Remove the fields that don't exist.
        for (const key of Object.keys(body)) {
          if (!tableInfo[key]) delete body[key];
        }
        //  Convert the timestamp field from number to text.
        if (body.timestamp) {
          body.timestamp = new Date(parseInt(body.timestamp, 10));
        }
        //  Insert the record.
        return db(table).insert(body)
          .catch((error) => {
            scloud.error(req, 'task', { error, device, body, table, reuseCount, wrapCount });
            return error;  //  Suppress error.
          });
      })
      .then((res) => { result = res; })
      .then(() => {
        //  If DESTROYPOOL is set in environment, tear down the Knex pool or AWS Lambda will not terminate.
        if (db && process.env.DESTROYPOOL) {
          db.destroy();
          db = null;
        }
      })
      .then(() => scloud.log(req, 'task', { result, device, body, table, reuseCount, wrapCount }))
      //  Return the message for the next processing step.
      .then(() => msg)
      .catch((error) => { scloud.log(req, 'task', { error, device, body, msg, table }); throw error; });
  }

  //  Expose these functions outside of the wrapper.  task() is called to execute
  //  the wrapped function when the dependencies and the wrapper have been loaded.
  return { task };
}

//  //////////////////////////////////////////////////////////////////////////////////// endregion
//  region Standard Code for AutoInstall Startup Function 1.0.  Do not modify.  https://github.com/UnaBiz/sigfox-iot-cloud/blob/master/autoinstall.js
/*  eslint-disable camelcase,no-unused-vars,import/no-absolute-path,import/no-unresolved,no-use-before-define,global-require,max-len,no-tabs,brace-style,import/no-extraneous-dependencies */
const wrapper = {};  //  The single reused wrapper instance (initially empty) for invoking the module functions.
exports.main = process.env.FUNCTION_NAME ? require('sigfox-gcloud/main').getMainFunction(wrapper, wrap, package_json)  //  Google Cloud.
  : (event, context, callback) => {
    const afterExec = error => error ? callback(error, 'AutoInstall Failed')
      : require('/tmp/autoinstall').installAndRunWrapper(event, context, callback, package_json, __filename, wrapper, wrap);
    if (require('fs').existsSync('/tmp/autoinstall.js')) return afterExec(null);  //  Already downloaded.
    const cmd = 'curl -s -S -o /tmp/autoinstall.js https://raw.githubusercontent.com/UnaBiz/sigfox-iot-cloud/master/autoinstall.js';
    const child = require('child_process').exec(cmd, { maxBuffer: 1024 * 500 }, afterExec);
    child.stdout.on('data', console.log); child.stderr.on('data', console.error); return null; };
//  exports.main is the startup function for AWS Lambda and Google Cloud Function.
//  When AWS starts our Lambda function, we load the autoinstall script from GitHub to install any NPM dependencies.
//  For first run, install the dependencies specified in package_json and proceed to next step.
//  For future runs, just execute the wrapper function with the event, context, callback parameters.
//  //////////////////////////////////////////////////////////////////////////////////// endregion
