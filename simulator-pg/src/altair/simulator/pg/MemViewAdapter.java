package altair.simulator.pg;

import java.util.List;

import altair.simulator.infrastructure.mem.IMem;
import altair.simulator.infrastructure.mem.IMemView;
import altair.simulator.infrastructure.reg.real.IExternalReg;
import altair.simulator.infrastructure.reg.real.IReg;
import altair.util.java6.identifier.IIdentifier;

public class MemViewAdapter implements IMemView {

	public IIdentifier getIdentifier() {
		throw new UnsupportedOperationException();
	}

	public boolean lw(int address, IReg dst) {
		throw new UnsupportedOperationException();
	}

	public boolean sw(int address, IReg src) {
		throw new UnsupportedOperationException();
	}

	public boolean existAddress(int address) {
		throw new UnsupportedOperationException();
	}

	public boolean hasReadPermission(int address) {
		throw new UnsupportedOperationException();
	}

	public List<IMem> getMems() {
		throw new UnsupportedOperationException();
	}

	public IMem getMem(int address) {
		throw new UnsupportedOperationException();
	}

	public boolean hasWritePermission(int address) {
		throw new UnsupportedOperationException();
	}

	public IMem getMem(IIdentifier memIdentifier) {
		throw new UnsupportedOperationException();
	}

	public IExternalReg get(int address) {
		throw new UnsupportedOperationException();
	}

	public MemOffset getMemAndRelativeOffset(int address) {
		throw new UnsupportedOperationException();
	}

	public int getMemOffset(IMem mem) {
		throw new UnsupportedOperationException();
	}

	public String info() {
		throw new UnsupportedOperationException();
	}

}
