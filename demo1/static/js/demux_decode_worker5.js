importScripts('./mp4box.all.min.js');
importScripts('./mp4_demuxer5.js');

self.addEventListener('message', function(e) {
  let size = 0;
  let offscreen = e.data.canvas;
  //Returns a rendering context for the offscreen canvas.
  let ctx = offscreen.getContext('2d');
  let startTime = 0;
  let frameCount = 0;

  let demuxer = new MP4Demuxer("/static/media/testav1.mp4");

  function getFrameStats() {
    //ms
      let now = performance.now();
      let fps = "";

      if (frameCount++) {
        let elapsed = now - startTime;
        //画面每秒传输帧数，通俗来讲就是指动画或视频的画面数。
        console.log(elapsed)
      } else {
        // This is the first frame.
        startTime = now;
      }
  }

  let decoder = new VideoDecoder({
    output : frame => {
      // console.log(frame.format)
      size += frame.allocationSize()
      console.log(size)
      // ctx.drawImage(frame, 0, 0, offscreen.width, offscreen.height);
      //
      // // Close ASAP.
      frame.close();
      getFrameStats()
      //
      // // Draw some optional stats.
      // ctx.font = '35px sans-serif';
      // ctx.fillStyle = "#ffffff";
      // ctx.fillText(getFrameStats(), 40, 40, offscreen.width);
    },
    error : e => console.error(e),
  });

  demuxer.getConfig().then((config) => {
    offscreen.height = config.codedHeight;
    offscreen.width = config.codedWidth;
    console.log("config codec is ....")
    console.log(config.codec)

    decoder.configure(config);
    demuxer.start((chunk) => { decoder.decode(chunk); })
    console.log("finish all decode")
  });
})
