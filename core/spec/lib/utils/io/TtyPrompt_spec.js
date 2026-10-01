import TtyPrompt from '../../../../lib/utils/io/TtyPrompt.js';

describe('TtyPrompt', () => {
  function fakeFs(input, { openError, readError } = {}) {
    const bytes = Buffer.from(input);
    let offset = 0;

    return {
      written: '',
      openSync: jasmine.createSpy('openSync').and.callFake(() => {
        if (openError) {
          throw openError;
        }

        return 7;
      }),
      readSync(fd, buffer) {
        if (readError) {
          throw readError;
        }

        if (offset >= bytes.length) {
          return 0;
        }

        buffer[0] = bytes[offset];
        offset += 1;

        return 1;
      },
      writeSync(fd, text) {
        this.written += text;
      },
      closeSync: jasmine.createSpy('closeSync')
    };
  }

  describe('#open', () => {
    it('opens the device read/write and reports success', () => {
      const fs = fakeFs('');
      const tty = new TtyPrompt({ device: '/dev/fake', fs });

      expect(tty.open()).toBeTrue();
      expect(fs.openSync).toHaveBeenCalledWith('/dev/fake', 'r+');
    });

    it('reports failure when the device cannot be opened', () => {
      const tty = new TtyPrompt({ fs: fakeFs('', { openError: new Error('ENXIO') }) });

      expect(tty.open()).toBeFalse();
    });

    it('defaults to the real /dev/tty and fs', () => {
      expect(new TtyPrompt()._device).toEqual('/dev/tty');
    });
  });

  describe('#ask', () => {
    it('writes the question and returns the parsed, trimmed answer', () => {
      const fs = fakeFs('  yes  \n');
      const tty = new TtyPrompt({ fs });

      tty.open();

      expect(tty.ask('Go? ', (answer) => answer)).toEqual('yes');
      expect(fs.written).toEqual('Go? ');
    });

    it('re-asks while the parser rejects the answer', () => {
      const fs = fakeFs('maybe\ny\n');
      const tty = new TtyPrompt({ fs });

      tty.open();

      expect(tty.ask('Go? ', (answer) => (answer === 'y' ? true : undefined))).toBeTrue();
      expect(fs.written).toEqual('Go? Go? ');
    });

    it('returns null at EOF, including an unterminated last chunk', () => {
      const tty = new TtyPrompt({ fs: fakeFs('partial') });

      tty.open();

      expect(tty.ask('Go? ', (answer) => answer)).toBeNull();
    });

    it('returns null when reading fails', () => {
      const tty = new TtyPrompt({ fs: fakeFs('', { readError: new Error('EIO') }) });

      tty.open();

      expect(tty.ask('Go? ', (answer) => answer)).toBeNull();
    });
  });

  describe('#write', () => {
    it('writes text to the device', () => {
      const fs = fakeFs('');
      const tty = new TtyPrompt({ fs });

      tty.open();
      tty.write('hello\n');

      expect(fs.written).toEqual('hello\n');
    });
  });

  describe('#close', () => {
    it('closes an open device once', () => {
      const fs = fakeFs('');
      const tty = new TtyPrompt({ fs });

      tty.open();
      tty.close();
      tty.close();

      expect(fs.closeSync).toHaveBeenCalledOnceWith(7);
    });

    it('does nothing when the device was never opened', () => {
      const fs = fakeFs('');

      new TtyPrompt({ fs }).close();

      expect(fs.closeSync).not.toHaveBeenCalled();
    });
  });
});
