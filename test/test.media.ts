// Copyright 2014-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as assert from 'power-assert';
import * as async from 'async';
import * as fs from 'fs';
import * as nock from 'nock';
import * as path from 'path';
import utils from './utils';
let googleapis = require('../');

const boundaryPrefix = 'multipart/related; boundary=';

function testMultpart (drive, cb) {
  const resource = { title: 'title', mimeType: 'text/plain' };
  const media = { body: 'hey' };
  let expectedResp = fs.readFileSync(
    path.join(__dirname, '/fixtures/media-response.txt'),
    { encoding: 'utf8' }
  );
  const req = drive.files.insert({ resource: resource, media: media }, (err, body) => {
    if (err) {
      return cb(err);
    }
    assert.equal(req.method, 'POST');
    assert.equal(
      req.uri.href,
      'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart'
    );
    assert.equal(req.headers['content-type'].indexOf('multipart/related;'), 0);
    const boundary = req.headers['content-type'].replace(boundaryPrefix, '');
    expectedResp = expectedResp
        .replace(/\n/g, '\r\n')
        .replace(/\$boundary/g, boundary)
        .replace('$media', media.body)
        .replace('$resource', JSON.stringify(resource))
        .replace('$mimeType', 'text/plain')
        .trim();
    assert.strictEqual(expectedResp, body);
    cb();
  });
}

function testMediaBody (drive, cb) {
  const resource = { title: 'title' };
  const media = { body: 'hey' };
  let expectedResp = fs.readFileSync(
    path.join(__dirname, '/fixtures/media-response.txt'),
    { encoding: 'utf8' }
  );
  const req = drive.files.insert({ resource: resource, media: media }, (err, body) => {
    if (err) {
      return cb(err);
    }
    assert.equal(req.method, 'POST');
    assert.equal(
      req.uri.href,
      'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart'
    );
    assert.equal(req.headers['content-type'].indexOf('multipart/related;'), 0);
    const boundary = req.headers['content-type'].replace(boundaryPrefix, '');
    expectedResp = expectedResp
        .replace(/\n/g, '\r\n')
        .replace(/\$boundary/g, boundary)
        .replace('$media', media.body)
        .replace('$resource', JSON.stringify(resource))
        .replace('$mimeType', 'text/plain')
        .trim();
    assert.strictEqual(expectedResp, body);
    cb();
  });
}

describe('Media', () => {
  let localDrive, remoteDrive;
  let localGmail, remoteGmail;

  before((done) => {
    nock.cleanAll();
    const google = new googleapis.GoogleApis();
    nock.enableNetConnect();
    async.parallel([
      (cb) => {
        utils.loadApi(google, 'drive', 'v2', {}, cb);
      },
      (cb) => {
      utils.loadApi(google, 'gmail', 'v1', {}, cb);
      }
    ], (err, apis) => {
      if (err) {
        return done(err);
      }
      remoteDrive = apis[0];
      remoteGmail = apis[1];
      nock.disableNetConnect();
      done();
    });
  });

  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
    const google = new googleapis.GoogleApis();
    localDrive = google.drive('v2');
    localGmail = google.gmail('v1');
  });

  it('should post with uploadType=multipart if resource and media set', (done) => {
    const scope = nock('https://www.googleapis.com')
        .post('/upload/drive/v2/files?uploadType=multipart')
        .times(2)
        .reply(200, { fileId: 'abc123' });

    localDrive.files.insert({ resource: {}, media: { body: 'hello' } }, (err, body) => {
      if (err) {
        return done(err);
      }
      assert.equal(JSON.stringify(body), JSON.stringify({ fileId: 'abc123' }));
      remoteDrive.files.insert({ resource: {}, media: { body: 'hello' } }, (err, body) => {
        if (err) {
          return done(err);
        }
        assert.equal(JSON.stringify(body), JSON.stringify({ fileId: 'abc123' }));
        scope.done();
        done();
      });
    });
  });

  it('should post with uploadType=media media set but not resource', (done) => {
    const scope = nock('https://www.googleapis.com')
        .post('/upload/drive/v2/files?uploadType=media')
        .times(2)
        .reply(200, { fileId: 'abc123' });
    localDrive.files.insert({ media: { body: 'hello' } }, (err, body) => {
      if (err) {
        return done(err);
      }
      assert.equal(JSON.stringify(body), JSON.stringify({ fileId: 'abc123' }));
      remoteDrive.files.insert({ media: { body: 'hello' } }, (err, body) => {
        if (err) {
          return done(err);
        }
        assert.equal(JSON.stringify(body), JSON.stringify({ fileId: 'abc123' }));
        scope.done();
        done();
      });
    });
  });

  it('should generate a valid media upload if media is set, metadata is not set', (done) => {
    const scope = nock('https://www.googleapis.com')
      .post('/upload/drive/v2/files?uploadType=media')
      .times(2)
      .reply(201, (uri, reqBody) => {
        return reqBody; // return request body as response for testing purposes
      });
    const media = { body: 'hey' };
    let req = localDrive.files.insert({ media: media }, (err, body) => {
      if (err) {
        return done(err);
      }
      assert.equal(req.method, 'POST');
      assert.equal(
        req.uri.href,
        'https://www.googleapis.com/upload/drive/v2/files?uploadType=media'
      );
      assert.strictEqual(media.body, body);
      req = remoteDrive.files.insert({ media: media }, (err, body) => {
        if (err) {
          return done(err);
        }
        assert.equal(req.method, 'POST');
        assert.equal(
          req.uri.href,
          'https://www.googleapis.com/upload/drive/v2/files?uploadType=media'
        );
        assert.strictEqual(media.body, body);
        scope.done();
        done();
      });
    });
  });

  it('should generate valid multipart upload if media and metadata are both set', (done) => {
    const scope = nock('https://www.googleapis.com')
      .post('/upload/drive/v2/files?uploadType=multipart')
      .times(2)
      .reply(201, (uri, reqBody) => {
        return reqBody; // return request body as response for testing purposes
      });

    testMultpart(localDrive, (err) => {
      if (err) {
        return done(err);
      }
      testMultpart(remoteDrive, (err) => {
        if (err) {
          return done(err);
        }
        scope.done();
        done();
      });
    });
  });

  it('should not require parameters for insertion requests', () => {
    let req = localDrive.files.insert({
      someAttr: 'someValue',
      media: { body: 'wat' }
    }, utils.noop);
    assert.equal(req.uri.query, 'someAttr=someValue&uploadType=media');
    req = remoteDrive.files.insert({
      someAttr: 'someValue',
      media: { body: 'wat' }
    }, utils.noop);
    assert.equal(req.uri.query, 'someAttr=someValue&uploadType=media');
  });

  it('should not multipart upload if no media body given', () => {
    let req = localDrive.files.insert({ someAttr: 'someValue' }, utils.noop);
    assert.equal(req.uri.query, 'someAttr=someValue');
    req = remoteDrive.files.insert({ someAttr: 'someValue' }, utils.noop);
    assert.equal(req.uri.query, 'someAttr=someValue');
  });

  it('should set text/plain when passed a string as media body', (done) => {
    const scope = nock('https://www.googleapis.com')
      .post('/upload/drive/v2/files?uploadType=multipart')
      .times(2)
      .reply(201, (uri, reqBody) => {
        return reqBody; // return request body as response for testing purposes
      });

    testMediaBody(localDrive, (err) => {
      if (err) {
        return done(err);
      }
      testMediaBody(remoteDrive, (err) => {
        if (err) {
          return done(err);
        }
        scope.done();
        done();
      });
    });
  });

  it('should handle metadata-only media requests properly', (done) => {
    const scope = nock('https://www.googleapis.com')
      .post('/gmail/v1/users/me/drafts')
      .times(2)
      .reply(201, (uri, reqBody) => {
        return reqBody; // return request body as response for testing purposes
      });
    const resource = { message: { raw: (new Buffer('hello', 'binary')).toString('base64') } };
    let req = localGmail.users.drafts.create(
      { userId: 'me', resource: resource, media: { mimeType: 'message/rfc822' } },
      (err, resp) => {
        if (err) {
          return done(err);
        }
        assert.equal(req.headers['content-type'], 'application/json');
        assert.equal(JSON.stringify(resp), JSON.stringify(resource));
        req = remoteGmail.users.drafts.create(
        { userId: 'me', resource: resource, media: { mimeType: 'message/rfc822' } },
        (err, resp) => {
          if (err) {
            return done(err);
          }
          assert.equal(req.headers['content-type'], 'application/json');
          assert.equal(JSON.stringify(resp), JSON.stringify(resource));
          scope.done();
          done();
        }
      );
      }
    );
  });

  it('should accept readable stream as media body without metadata', (done) => {
    const scope = nock('https://www.googleapis.com')
      .post('/upload/gmail/v1/users/me/drafts?uploadType=media')
      .times(2)
      .reply(201, (uri, reqBody) => {
        return reqBody; // return request body as response for testing purposes
      });

    let body = fs.createReadStream(path.join(__dirname, '/fixtures/mediabody.txt'));
    let expectedBody = fs.readFileSync(path.join(__dirname, '/fixtures/mediabody.txt'));
    localGmail.users.drafts.create({
      userId: 'me',
      media: {
        mimeType: 'message/rfc822',
        body: body
      }
    }, (err, resp) => {
      if (err) {
        return done(err);
      }
      assert.equal(resp, expectedBody);
      body = fs.createReadStream(path.join(__dirname, '/fixtures/mediabody.txt'));
      expectedBody = fs.readFileSync(path.join(__dirname, '/fixtures/mediabody.txt'));
      remoteGmail.users.drafts.create({
        userId: 'me',
        media: {
          mimeType: 'message/rfc822',
          body: body
        }
      }, (err, resp) => {
        if (err) {
          return done(err);
        }
        assert.equal(resp, expectedBody);
        scope.done();
        done();
      });
    });
  });

  it('should accept readable stream as media body with metadata', (done) => {
    const scope = nock('https://www.googleapis.com')
      .post('/upload/gmail/v1/users/me/drafts?uploadType=multipart')
      .times(2)
      .reply(201, (uri, reqBody) => {
        return reqBody; // return request body as response for testing purposes
      });

    let resource = { message: { raw: (new Buffer('hello', 'binary')).toString('base64') } };
    let body = fs.createReadStream(path.join(__dirname, '/fixtures/mediabody.txt'));
    let bodyString = fs.readFileSync(path.join(__dirname, '/fixtures/mediabody.txt'), { encoding: 'utf8' });
    let media = { mimeType: 'message/rfc822', body: body };
    let expectedBody = fs.readFileSync(
      path.join(__dirname, '/fixtures/media-response.txt'),
      { encoding: 'utf8' }
    );
    let req = localGmail.users.drafts.create({
      userId: 'me',
      resource: resource,
      media: media
    }, (err, resp) => {
      if (err) {
        return done(err);
      }
      const boundary = req.headers['content-type'].replace(boundaryPrefix, '');
      expectedBody = expectedBody
          .replace(/\n/g, '\r\n')
          .replace(/\$boundary/g, boundary)
          .replace('$media', bodyString)
          .replace('$resource', JSON.stringify(resource))
          .replace('$mimeType', 'message/rfc822')
          .trim();
      assert.strictEqual(expectedBody, resp);
      resource = { message: { raw: (new Buffer('hello', 'binary')).toString('base64') } };
      body = fs.createReadStream(path.join(__dirname, '/fixtures/mediabody.txt'));
      bodyString = fs.readFileSync(path.join(__dirname, '/fixtures/mediabody.txt'), { encoding: 'utf8' });
      media = { mimeType: 'message/rfc822', body: body };
      expectedBody = fs.readFileSync(
        path.join(__dirname, '/fixtures/media-response.txt'),
        { encoding: 'utf8' }
      );
      req = remoteGmail.users.drafts.create({
        userId: 'me',
        resource: resource,
        media: media
      }, (err, resp) => {
        if (err) {
          return done(err);
        }
        const boundary = req.headers['content-type'].replace(boundaryPrefix, '');
        expectedBody = expectedBody
            .replace(/\n/g, '\r\n')
            .replace(/\$boundary/g, boundary)
            .replace('$media', bodyString)
            .replace('$resource', JSON.stringify(resource))
            .replace('$mimeType', 'message/rfc822')
            .trim();
        assert.strictEqual(expectedBody, resp);
        scope.done();
        done();
      });
    });
  });

  it('should return err, {object}body, resp for streaming media requests', (done) => {
    const scope = nock('https://www.googleapis.com')
      .post('/upload/gmail/v1/users/me/drafts?uploadType=multipart')
      .times(2)
      .reply(201, () => {
        return JSON.stringify({ hello: 'world' });
      });

    let resource = { message: { raw: (new Buffer('hello', 'binary')).toString('base64') } };
    let body = fs.createReadStream(path.join(__dirname, '/fixtures/mediabody.txt'));
    let media = { mimeType: 'message/rfc822', body: body };
    localGmail.users.drafts.create({
      userId: 'me',
      resource: resource,
      media: media
    }, (err, body, resp) => {
      if (err) {
        return done(err);
      }
      assert.equal(typeof body, 'object');
      assert.equal(body.hello, 'world');
      assert.equal(typeof resp, 'object');
      assert.equal(resp.body, JSON.stringify(body));
      resource = { message: { raw: (new Buffer('hello', 'binary')).toString('base64') } };
      body = fs.createReadStream(path.join(__dirname, '/fixtures/mediabody.txt'));
      media = { mimeType: 'message/rfc822', body: body };
      remoteGmail.users.drafts.create({
        userId: 'me',
        resource: resource,
        media: media
      }, (err, body, resp) => {
        if (err) {
          return done(err);
        }
        assert.equal(typeof body, 'object');
        assert.equal(body.hello, 'world');
        assert.equal(typeof resp, 'object');
        assert.equal(resp.body, JSON.stringify(body));
        scope.done();
        done();
      });
    });
  });

  after(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});
