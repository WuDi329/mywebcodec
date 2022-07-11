class MP4Source {
  constructor(uri) {
    this.file = MP4Box.createFile();
    this.file.onError = console.error.bind(console);
    //设置 onReady 回调并以 ArrayBuffer 对象的形式提供数据。 MP4Box.js 支持渐进式解析。 您可以一次提供小缓冲区，当解析“moov”框时将调用回调。
    //onMoovStart 回调在开始解析“moov”框时调用。 根据下载速度，下载整个“moov”框可能需要一段时间。 解析结束由 onReady 回调发出信号。
    //onReady 回调在“moov”框已被解析时调用，即当有关文件的元数据被解析时。
    this.file.onReady = this.onReady.bind(this);
    //Callback called when a set of samples is ready, according to the options passed in setExtractionOptions.
    // user is the caller of the segmentation, for this track, and samples is an Array of samples.
    //  function (id, user, samples)
    this.file.onSamples = this.onSamples.bind(this);


    //debugger
    fetch(uri).then(response => {
      const reader = response.body.getReader();
      let offset = 0;
      let mp4File = this.file;

      function appendBuffers({done, value}) {
        if(done) {
          //表示将不再接收数据，并且应在分段或提取过程中刷新所有剩余的样本。
          mp4File.flush();
          console.log("get allllllll the data")
          return;
        }

        let buf = value.buffer;
        buf.fileStart = offset;

        offset += buf.byteLength;

        mp4File.appendBuffer(buf);

        return reader.read().then(appendBuffers);
      }

      // read() 返回一个 promise，其会在接收到数据时被兑现
      // 如果有分块可用，则 promise 将使用 { value: theChunk, done: false } 形式的对象来兑现。
      // 如果流已经关闭，则 promise 将使用 { value: undefined, done: true } 形式的对象来兑现。
      return reader.read().then(appendBuffers);
    })

    this.info = null;
    this._info_resolver = null;
  }

  //1
  onReady(info) {
    //debugger
    // TODO: Generate configuration changes.
    this.info = info;
    console.log("info")
    console.log(info);

    if (this._info_resolver) {
      this._info_resolver(info);
      this._info_resolver = null;
    }
  }

  //0
  getInfo() {
    //debugger
    console.log("info exist ?")
    if (this.info)
      return Promise.resolve(this.info);
    console.log("no")
    return new Promise((resolver) => {
      //debugger
      console.log(this)
      console.log(resolver)
      this._info_resolver = resolver;
    });
  }

  //2
  getav01box() {
        console.log("get source of avcc")
    console.log(this.file.moov.traks[0].mdia.minf.stbl.stsd.entries[0])
    // TODO: make sure this is coming from the right track.
    return this.file.moov.traks[0].mdia.minf.stbl.stsd.entries[0].hvcC
  }


  //3
  start(track, onChunk) {

    this._onChunk = onChunk;
    // with the given options. When samples are ready, the callback onSamples is called with the user parameter.
    // when samples is ready, onsample will be called automically
    this.file.setExtractionOptions(track.id);
    //debugger
    console.log("start")
    //Indicates that sample processing can start (segmentation or extraction).
    // Sample data already received will be processed
    // and new buffer append operation will trigger sample processing as well.
    this.file.start();
  }


  //after start
  onSamples(track_id, ref, samples) {
    console.log("onsamples...")
    for (const sample of samples) {
      const type = sample.is_sync ? "key" : "delta";

      const chunk = new EncodedVideoChunk({
        type: type,
        timestamp: sample.cts,
        duration: sample.duration,
        data: sample.data
      });

      this._onChunk(chunk);
    }

  }
}

class Writer {
  constructor(size) {
    this.data = new Uint8Array(size);
    this.idx = 0;
    this.size = size;
  }

  getData() {
    if(this.idx != this.size)
      throw "Mismatch between size reserved and sized used"

    return this.data.slice(0, this.idx);
  }

  writeUint8(value) {
    this.data.set([value], this.idx);
    this.idx++;
  }

  writeUint32(value) {
    var arr = new Uint32Array(1);
    arr[0] = value;
    var buffer = new Uint8Array(arr.buffer);
    this.data.set(([buffer[3], buffer[2], buffer[1], buffer[0]], this.idx));
    this.idx += 4;
  }

  writeUint16(value) {
    // TODO: find a more elegant solution to endianess.
    var arr = new Uint16Array(1);
    arr[0] = value;
    var buffer = new Uint8Array(arr.buffer);
    this.data.set([buffer[1], buffer[0]], this.idx);
    this.idx +=2;
  }


  writeUint8Array(value) {
    this.data.set(value, this.idx);
    this.idx += value.length;
  }
}

class MP4Demuxer {
  constructor(uri) {
    this.source = new MP4Source(uri);
  }

  getExtradata(hvccBox) {
    console.log("hvccbox")
    console.log(hvccBox)
    var i, j;
    var size = 23;
    for (i = 0; i < hvccBox.nalu_arrays.length; i++) {
      // nalu length is encoded as a uint16.
      size+= 3;
      for (j = 0; j < hvccBox.nalu_arrays[i].length; j++) {
      // nalu length is encoded as a uint16.
      size+= 2 + hvccBox.nalu_arrays[i][j].data.length;
      }
    }

    console.log(size)

    var writer = new Writer(size);

    writer.writeUint8(hvccBox.configurationVersion);
    writer.writeUint8(hvccBox.general_profile_idc + 32 * hvccBox.general_tier_flag + 64 * hvccBox.general_profile_space);
    writer.writeUint32(hvccBox.general_profile_compatibility);
    writer.writeUint8Array(hvccBox.general_constraint_indicator);
    writer.writeUint8(hvccBox.general_level_idc);
    writer.writeUint16(hvccBox.min_spatial_segmentation_idc + (15 << 12));
    writer.writeUint8(hvccBox.parallelismType + (63 << 2));
    writer.writeUint8(hvccBox.chroma_format_idc + (63 << 2));
    writer.writeUint8(hvccBox.bit_depth_luma_minus8 + (31 << 3));
    writer.writeUint8(hvccBox.bit_depth_chroma_minus8 + (31 << 3));
    writer.writeUint16(hvccBox.avgFrameRate);
    writer.writeUint8(64*hvccBox.constantFrameRate + 8 * hvccBox.numTemporalLayers + 4 * hvccBox.temporalIdNested + hvccBox.lengthSizeMinusOne)
    writer.writeUint8(hvccBox.nalu_arrays.length)
    for (i = 0; i < hvccBox.nalu_arrays.length; i++) {
      writer.writeUint8(hvccBox.nalu_arrays[i].completeness*128 + hvccBox.nalu_arrays[i].nalu_type);
      writer.writeUint16(hvccBox.nalu_arrays[i].length)
      for (j = 0; j < hvccBox.nalu_arrays[i].length; j++) {
         writer.writeUint16(hvccBox.nalu_arrays[i][j].data.length)
         writer.writeUint8Array(hvccBox.nalu_arrays[i][j].data)
      }
    }
    return writer.getData();
  }

  async getConfig() {
    //debugger
    let info = await this.source.getInfo();
    //debugger
    console.log("getconfig...")
    console.log(info)
    this.track = info.videoTracks[0];
    console.log("track codec")
    console.log(this.track.codec)

   let config = {
      //codec: this.track.codec, //av01.0.8M.08
     codec: 'av01.0.08M.08',
      codedHeight: this.track.video.height,
      codedWidth: this.track.video.width
    }

    return Promise.resolve(config);
  }

  start(onChunk) {
    this.source.start(this.track, onChunk);
  }
}
