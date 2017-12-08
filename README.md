**sigfox-iot-data** is a
 [`sigfox-gcloud`](https://www.npmjs.com/package/sigfox-gcloud) and
 [`sigfox-aws`](https://www.npmjs.com/package/sigfox-aws) 
adapter for writing Sigfox messages into SQL databases like MySQL and Postgres.

You may read and update Sigfox messages with other modules (such as 
[`sigfox-iot-ubidots`](https://www.npmjs.com/package/sigfox-iot-ubidots))
before passing to `sigfox-iot-data` for writing to the database.
`sigfox-iot-data` works with most SQL databases supported by 
[Knex.js](http://knexjs.org/)
like **MySQL, Postgres, MSSQL, MariaDB and Oracle.**

`sigfox-iot-data` was built with `sigfox-aws` / `sigfox-gcloud`, an open-source software framework for building a
Sigfox server with AWS IoT / Google Cloud Functions.  Check out [`sigfox-aws`](https://www.npmjs.com/package/sigfox-aws),  [`sigfox-gcloud`](https://www.npmjs.com/package/sigfox-gcloud)

_`sigfox-iot-data` with MySQL:_<br>
[<kbd><img src="https://storage.googleapis.com/unabiz-media/sigfox-gcloud/data-mysql.png" width="800"></kbd>](https://storage.googleapis.com/unabiz-media/sigfox-gcloud/data-mysql.png)

_`sigfox-iot-data` with Postgres:_<br>
[<kbd><img src="https://storage.googleapis.com/unabiz-media/sigfox-gcloud/data-postgres.jpg" width="800"></kbd>](https://storage.googleapis.com/unabiz-media/sigfox-gcloud/data-postgres.png)

# Installation for AWS

See instructions at:

https://github.com/UnaBiz/sigfox-iot-data/blob/master/aws/index.js

#  Demo    

1. To send messages from a Sigfox device into your database, you may use this Arduino sketch:

    https://github.com/UnaBiz/unabiz-arduino/blob/master/examples/send-light-level/send-light-level.ino
    
    The sketch sends 3 field names and field values, packed into a Structured Message:
        
    ```
    ctr - message counter
    lig - light level, based on the Grove analog light sensor
    tmp - module temperature, based on the Sigfox module's embedded temperature sensor        
    ```

1. Alternatively, you may test by sending a Sigfox message
    from your Sigfox device with the `data` field set to:

    ```
    920e82002731b01db0512201
    ```
   
   We may also use a URL testing tool like Postman to send a POST request to the `sigfoxCallback` URL.

   Set the `Content-Type` header to `application/json`. 
   If you're using Postman, click `Body` -> `Raw` -> `JSON (application/json)`
   Set the body to:
   
    ```json
    {
      "device":"1A2345",
      "data":"920e82002731b01db0512201",
      "time":"1476980426",
      "duplicate":"false",
      "snr":"18.86",
      "station":"0000",
      "avgSnr":"15.54",
      "lat":"1",
      "lng":"104",
      "rssi":"-123.00",
      "seqNumber":"1492",
      "ack":"false",
      "longPolling":"false"
    }
    ```
    where `device` is your Sigfox device ID.
    
    Here's the request in Postman:
    
     [<kbd><img src="https://storage.googleapis.com/unabiz-media/sigfox-gcloud/postman-callback.png" width="1024"></kbd>](https://storage.googleapis.com/unabiz-media/sigfox-gcloud/postman-callback.png)
     
1.  The response from the callback function should look like this:
    
    ```json
    {
      "1A2345": {
        "noData": true
      }
    }
    ```
           
1. The test message sent above will be decoded and written to your `sensordata` 
    table as 

    ```
    ctr (counter): 13
    lig (light level): 760
    tmp (temperature): 29        
    ```
    
    The other fields of the Sigfox message will be written as well.
