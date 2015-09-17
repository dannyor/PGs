package altair.simulator.pg;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import altair.simulator.infrastructure.mem.IMem;
import altair.simulator.infrastructure.mem.IMemView;
import altair.simulator.infrastructure.reg.real.IExternalReg;
import altair.simulator.infrastructure.reg.real.IReg;
import altair.util.java6.identifier.IIdentifier;
import altair.util.java6.identifier.StringIdentifier;

public class MockMemView implements IMemView {

	Map<Integer, IReg> memMap = new HashMap<Integer, IReg>();
	Map<IIdentifier, IMem> identifier2mem = new HashMap<IIdentifier, IMem>();
	
	@Override
	public boolean lw(int address, IReg dst) {
		throw new UnsupportedOperationException();
	}

	@Override
	public boolean sw(int address, IReg src) {
		throw new UnsupportedOperationException();
	}

	@Override
	public boolean existAddress(int address) {
		return true;
	}

	@Override
	public boolean hasReadPermission(int address) {
		return true;
	}

	@Override
	public boolean hasWritePermission(int address) {
		return true;
	}

	@Override
	public IExternalReg get(int address) {
		return null;
	}

	@Override
	public IIdentifier getIdentifier() {
		return StringIdentifier.identifier("EV");
	}

	@Override
	public List<IMem> getMems() {
		throw new UnsupportedOperationException();
	}

	@Override
	public IMem getMem(int address) {
		return null;
	}

	@Override
	public IMem getMem(IIdentifier memIdentifier) {
		return null;
	}

	@Override
	public MemOffset getMemAndRelativeOffset(int address) {
		return null;
	}

	@Override
	public int getMemOffset(IMem mem) {
		return 0;
	}

	@Override
	public String info() {
		return null;
	}

}
