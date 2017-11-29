#!/usr/bin/env bash

name=sendToDatabase
localpath=gcloud
trigger=--trigger-topic
topic=sigfox.types.sendToDatabase
export options="--memory=1024MB --timeout=500"

./gcloud/functiondeploy.sh ${name}   ${localpath} ${trigger} ${topic}
