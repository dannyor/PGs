package altair.simulator.pg;

import java.util.List;

import altair.simulator.infrastructure.mem.IMem;
import altair.simulator.infrastructure.mem.IMemView;
import altair.simulator.infrastructure.reg.real.IExternalReg;
import altair.simulator.infrastructure.reg.real.IReg;
import altair.simulator.pg.reflect.MethodInvocationLogger;
import altair.util.java6.identifier.IIdentifier;

public class WrappedMemView implements IMemView {

	IMemView delegate;

	public WrappedMemView(IMemView delegate) {
		this.delegate = delegate;
	}

	public IIdentifier getIdentifier() {
		throw new UnsupportedOperationException();
	}

	public boolean lw(int address, IReg dst) {
		return delegate.lw(address, dst);
	}

	public boolean sw(int address, IReg src) {
		return delegate.sw(address, src);
	}

	public boolean existAddress(int address) {
		return delegate.existAddress(address);
	}

	public boolean hasReadPermission(int address) {
		return delegate.hasReadPermission(address);
	}

	public List<IMem> getMems() {
		return delegate.getMems();
	}

	public IMem getMem(int address) {
		return delegate.getMem(address);
	}

	public boolean hasWritePermission(int address) {
		return delegate.hasWritePermission(address);
	}

	public IMem getMem(IIdentifier memIdentifier) {
		 IMem mem = delegate.getMem(memIdentifier);
		 return MethodInvocationLogger.getLoggingInstance(mem, IMem.class, true);
	}

	public IExternalReg get(int address) {
		return delegate.get(address);
	}

	public MemOffset getMemAndRelativeOffset(int address) {
		return delegate.getMemAndRelativeOffset(address);
	}

	public int getMemOffset(IMem mem) {
		return delegate.getMemOffset(mem);
	}

	public String info() {
		return delegate.info();
	}

}
